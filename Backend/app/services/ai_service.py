"""CareAI model loading, input validation, and inference.

Two serialized scikit-learn pipelines back the advisory endpoints. Both encode
their categorical inputs with ``OneHotEncoder(handle_unknown="ignore")``, which
silently maps an unrecognised value to an all-zero vector. That behaviour turns
a typo — or any free-text clinical note — into a prediction that looks confident
but ignored the input entirely.

To prevent that, the exact training vocabulary is read back out of each fitted
encoder and enforced before inference. Callers can fetch the same vocabulary
from ``/ai/schema`` so the UI can offer real choices instead of free text.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from app.config.settings import settings

logger = logging.getLogger(__name__)

# The Severity / Severity_Score columns were trained on the integer range 1-5.
# Values above the trained maximum saturate against the outermost tree split and
# return an identical prediction, so they are rejected rather than accepted.
SEVERITY_MIN = 1
SEVERITY_MAX = 5

PRIORITY_MODEL_FILE = "patient_priority_rf_model.joblib"
WAIT_TIME_MODEL_FILE = "patient_wait_time_model.joblib"


class AIModelLoadError(RuntimeError):
    pass


class AIInputError(ValueError):
    """Raised when an input value lies outside the model's trained domain."""


def _candidate_model_dirs() -> list[Path]:
    configured = Path(settings.AI_MODEL_DIR)
    if configured.is_absolute():
        return [configured]
    # Resolve relative to the repository root, then to the Backend package root,
    # so the service works both from a checkout and from a Backend-only image.
    roots = [
        Path(__file__).resolve().parents[3],
        Path(__file__).resolve().parents[2],
        Path.cwd(),
    ]
    names = [configured]
    # "AI:ML" is not a portable directory name; accept the sanitised spellings too.
    if str(configured) == "AI:ML":
        names += [Path("AI_ML"), Path("AI-ML"), Path("models")]
    return [(root / name).resolve() for root in roots for name in names]


def _model_dir() -> Path:
    for candidate in _candidate_model_dirs():
        if (candidate / PRIORITY_MODEL_FILE).is_file():
            return candidate
    raise AIModelLoadError("AI models could not be located.")


@lru_cache(maxsize=1)
def _load_models() -> tuple[Any, Any]:
    try:
        model_dir = _model_dir()
        return (
            joblib.load(model_dir / PRIORITY_MODEL_FILE),
            joblib.load(model_dir / WAIT_TIME_MODEL_FILE),
        )
    except AIModelLoadError:
        raise
    except Exception as exc:
        # Never surface the underlying path or pickle detail to the caller.
        logger.exception("AI model loading failed")
        raise AIModelLoadError("AI models could not be loaded.") from exc


def _categorical_vocabulary(pipeline: Any) -> dict[str, list[str]]:
    """Read the exact categories each column was fitted on."""
    preprocessor = pipeline.named_steps["preprocessor"]
    vocabulary: dict[str, list[str]] = {}
    for name, transformer, columns in preprocessor.transformers_:
        if name != "cat" or transformer == "drop":
            continue
        encoder = transformer.named_steps["onehot"] if hasattr(transformer, "named_steps") else transformer
        for column, categories in zip(list(columns), encoder.categories_):
            vocabulary[str(column)] = [str(value) for value in categories]
    return vocabulary


@lru_cache(maxsize=1)
def input_schema() -> dict[str, Any]:
    """Describe the accepted inputs for both models, derived from the artifacts."""
    priority_model, wait_model = _load_models()
    return {
        "patient_priority": {
            "categorical": _categorical_vocabulary(priority_model),
            "numeric": {
                "Severity": {"minimum": SEVERITY_MIN, "maximum": SEVERITY_MAX},
                "Age": {"minimum": 0, "maximum": 130},
                "Number_of_Visits": {"minimum": 0},
                "Days_Since_Last_Visit": {"minimum": 0},
            },
            "classes": [int(value) for value in priority_model.classes_],
        },
        "wait_time": {
            "categorical": _categorical_vocabulary(wait_model),
            "numeric": {
                "Severity_Score": {"minimum": SEVERITY_MIN, "maximum": SEVERITY_MAX},
                "Age": {"minimum": 0, "maximum": 130},
                "Number_of_Visits": {"minimum": 0},
                "Symptom_Count": {"minimum": 0},
            },
        },
    }


def _validate_categoricals(values: dict[str, Any], vocabulary: dict[str, list[str]]) -> None:
    for column, allowed in vocabulary.items():
        supplied = values.get(column)
        if supplied is None:
            continue
        if str(supplied) not in allowed:
            raise AIInputError(
                f"'{column}' must be one of: {', '.join(allowed)}. "
                "Values outside the trained vocabulary are ignored by the model, "
                "so they are rejected instead of producing a misleading prediction."
            )


def _frame(model: Any, values: dict[str, Any]) -> pd.DataFrame:
    # Build the frame in the model's own column order so pandas never reorders
    # features underneath the pipeline.
    columns = [str(name) for name in model.feature_names_in_]
    return pd.DataFrame([{column: values.get(column) for column in columns}], columns=columns)


def predict_priority(values: dict[str, Any]) -> dict[str, Any]:
    priority_model, _ = _load_models()
    patient_id = values.pop("patient_id", None)
    _validate_categoricals(values, _categorical_vocabulary(priority_model))
    frame = _frame(priority_model, values)
    prediction = int(priority_model.predict(frame)[0])
    probabilities = priority_model.predict_proba(frame)[0]
    return {
        "patient_id": patient_id,
        "prediction": prediction,
        "probabilities": {
            str(label): float(value)
            for label, value in zip(priority_model.classes_, probabilities)
        },
        "advisory": "Operational decision support only; not a medical diagnosis or guaranteed clinical decision.",
    }


def predict_wait_time(values: dict[str, Any]) -> dict[str, Any]:
    _, wait_model = _load_models()
    patient_id = values.pop("patient_id", None)
    _validate_categoricals(values, _categorical_vocabulary(wait_model))
    frame = _frame(wait_model, values)
    return {
        "patient_id": patient_id,
        "estimated_wait_time": max(0.0, float(wait_model.predict(frame)[0])),
        "advisory": "Operational estimate only; actual waiting time may vary.",
    }
