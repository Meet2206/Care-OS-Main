from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from app.config.settings import settings


class AIModelLoadError(RuntimeError):
    pass


def _model_dir() -> Path:
    configured = Path(settings.AI_MODEL_DIR)
    if configured.is_absolute():
        return configured
    return (Path(__file__).resolve().parents[3] / configured).resolve()


@lru_cache(maxsize=1)
def _load_models() -> tuple[Any, Any]:
    model_dir = _model_dir()
    try:
        return (
            joblib.load(model_dir / "patient_priority_rf_model.joblib"),
            joblib.load(model_dir / "patient_wait_time_model.joblib"),
        )
    except Exception as exc:
        raise AIModelLoadError("AI models could not be loaded.") from exc


def predict_priority(values: dict[str, Any]) -> dict[str, Any]:
    priority_model, _ = _load_models()
    patient_id = values.pop("patient_id", None)
    frame = pd.DataFrame([values])
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
    frame = pd.DataFrame([values])
    return {
        "patient_id": patient_id,
        "estimated_wait_time": float(wait_model.predict(frame)[0]),
        "advisory": "Operational estimate only; actual waiting time may vary.",
    }
