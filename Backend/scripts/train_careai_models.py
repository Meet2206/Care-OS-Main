"""Train the two CareAI artifacts defined by jenil.md.

The script intentionally evaluates on held-out folds before fitting the final
artifacts on all valid rows. It does not use identifiers, dates, or free-text
descriptions as model features.
"""
from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    balanced_accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from sklearn.model_selection import KFold, StratifiedKFold, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "AI:ML"

PRIORITY_CATEGORICAL = ["Disease", "Gender", "Abnormal_Result", "Diagnosis", "Symptoms"]
PRIORITY_NUMERIC = ["Severity", "Age", "Number_of_Visits", "Days_Since_Last_Visit"]
PRIORITY_FEATURES = ["Disease", "Severity", "Gender", "Age", "Number_of_Visits", "Abnormal_Result", "Diagnosis", "Symptoms", "Days_Since_Last_Visit"]
WAIT_CATEGORICAL = ["Disease", "Gender", "Abnormal_Result", "Chronic_Condition"]
WAIT_NUMERIC = ["Age", "Number_of_Visits", "Symptom_Count", "Severity_Score"]
WAIT_FEATURES = ["Disease", "Gender", "Age", "Number_of_Visits", "Abnormal_Result", "Symptom_Count", "Chronic_Condition", "Severity_Score"]


def make_preprocessor(categorical: list[str], numeric: list[str]) -> ColumnTransformer:
    return ColumnTransformer(
        transformers=[
            ("num", Pipeline([("scaler", StandardScaler())]), numeric),
            ("cat", Pipeline([("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))]), categorical),
        ],
        remainder="drop",
    )


def train_priority() -> None:
    df = pd.read_csv(ROOT / "Dataset" / "patient_priority_dataset_500.csv")
    df = df[df["Priority_Score"].isin([1, 2, 3, 4, 5])].copy()
    X = df[PRIORITY_FEATURES]
    y = df["Priority_Score"].astype(int)
    estimator = RandomForestClassifier(
        n_estimators=400,
        max_depth=10,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    pipeline = Pipeline(
        [("preprocessor", make_preprocessor(PRIORITY_CATEGORICAL, PRIORITY_NUMERIC)), ("classifier", estimator)]
    )
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_validate(
        pipeline,
        X,
        y,
        cv=cv,
        scoring={"macro_f1": "f1_macro", "balanced_accuracy": "balanced_accuracy"},
    )
    print(
        f"Priority CV macro-F1={scores['test_macro_f1'].mean():.3f}; "
        f"balanced-accuracy={scores['test_balanced_accuracy'].mean():.3f}; rows={len(df)}"
    )
    pipeline.fit(X, y)
    joblib.dump(pipeline, MODEL_DIR / "patient_priority_rf_model.joblib")


def train_wait_time() -> None:
    df = pd.read_csv(ROOT / "Dataset" / "patient_estimated_time_dataset_500.csv")
    X = df[WAIT_FEATURES]
    y = df["Estimated_Time_Min"].astype(float)
    estimator = RandomForestRegressor(
        n_estimators=500,
        max_depth=10,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    pipeline = Pipeline(
        [("preprocessor", make_preprocessor(WAIT_CATEGORICAL, WAIT_NUMERIC)), ("regressor", estimator)]
    )
    cv = KFold(n_splits=5, shuffle=True, random_state=42)
    scores = cross_validate(
        pipeline,
        X,
        y,
        cv=cv,
        scoring={"mae": "neg_mean_absolute_error", "rmse": "neg_root_mean_squared_error", "r2": "r2"},
    )
    print(
        f"Wait-time CV MAE={-scores['test_mae'].mean():.2f}; "
        f"RMSE={-scores['test_rmse'].mean():.2f}; R2={scores['test_r2'].mean():.3f}; rows={len(df)}"
    )
    pipeline.fit(X, y)
    joblib.dump(pipeline, MODEL_DIR / "patient_wait_time_model.joblib")


if __name__ == "__main__":
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    train_priority()
    train_wait_time()
