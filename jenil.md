# CARE-OS — Machine Learning Engineering & Model Development Guide
**Document Purpose:** Complete specification, data contracts, feature schemas, training pipelines, and deployment instructions for **Jenil** (ML Engineer) to build, train, evaluate, and package the production machine learning models for CARE-OS.

---

## 1. Executive Overview & System Context

CARE-OS is a role-based hospital operations and clinical management system. The machine learning subsystem (**CareAI**) provides real-time, advisory clinical decision support and hospital operational insights to **Doctors**, **Receptionists**, and **Patients**.

```text
+-------------------------------------------------------------------------------+
|                             CARE-OS Web Application                           |
|      (Doctor Portal, Reception Desk, Patient Portal - React + Vite)           |
+-------------------------------------------------------------------------------+
                                      |
                                      | HTTP POST /api/v1/ai/* with Bearer JWT
                                      v
+-------------------------------------------------------------------------------+
|                           FastAPI Backend Service                             |
|               (app/routes/ai.py & app/services/ai_service.py)                |
+-------------------------------------------------------------------------------+
           |                                                 |
           v                                                 v
+------------------------------------+    +------------------------------------+
|  Model 1: Patient Priority Triage  |    |     Model 2: Wait-Time Predictor   |
|  (patient_priority_rf_model.joblib)|    |   (patient_wait_time_model.joblib) |
|  Type: RandomForestClassifier      |    |   Type: RandomForestRegressor      |
|  Task: 5-level Triage Priority     |    |   Task: Estimated Wait Time (mins) |
+------------------------------------+    +------------------------------------+
```

### Critical Operational Boundaries
1. **Advisory Decision Support Only:** Predictions are advisory operational tools to assist queue management and clinical triage; they do **not** replace certified medical diagnosis.
2. **Deterministic Schemas & Zero Silent Degradation:** The backend dynamically inspects fitted encoders. Any category outside the trained vocabulary causes a validation error (`422 Unprocessable Entity`) rather than being silently discarded by `OneHotEncoder(handle_unknown="ignore")`.
3. **Artifact Location:** Model artifacts are loaded at backend startup from the `AI:ML/` directory (or fallback aliases `AI_ML/`, `models/`).

---

## 2. Models to Build

Jenil is responsible for delivering **two trained scikit-learn Pipeline artifacts**:

| Model Name | Artifact Filename | ML Task | Target Variable | Evaluation Metrics |
|---|---|---|---|---|
| **Patient Priority Classifier** | `patient_priority_rf_model.joblib` | Multi-class Classification (5 classes) | `Priority_Score` (1 to 5) | Multi-class Macro F1-Score, Balanced Accuracy, Log-Loss |
| **Patient Wait-Time Regressor** | `patient_wait_time_model.joblib` | Continuous Regression | `Wait_Time` (minutes) | MAE, RMSE, R² Score |

---

## 3. Model 1: Patient Priority Triage Classifier

### 3.1 Objective
Predict the clinical urgency level of an incoming or queued patient on a 5-point triage scale:
- **Level 1 (Routine / Low):** Mild or chronic symptoms, stable vitals.
- **Level 2 (Standard):** Routine follow-up, minor acute symptoms.
- **Level 3 (Urgent):** Needs clinical assessment within reasonable queue time.
- **Level 4 (Highly Urgent):** Serious symptoms, potential rapid deterioration.
- **Level 5 (Critical / Emergency):** Severe/life-threatening symptoms, immediate attention.

### 3.2 Feature Specification & Schema
The model must accept exactly **9 input features** in the specified order:

| Feature Name | Type | Processing | Valid Domain / Range / Categories |
|---|---|---|---|
| `Disease` | Categorical | One-Hot Encoded | `['Arthritis', 'Asthma', 'COPD', 'Cancer', 'Common Cold', 'Diabetes', 'Fracture', 'Gastroenteritis', 'Heart Disease', 'Hypertension', 'Kidney Disease', 'Migraine', 'Pneumonia', 'Stroke', 'UTI']` (15 classes) |
| `Severity` | Numeric (int) | Scaled / Standardized | `1` to `5` (inclusive) |
| `Gender` | Categorical | One-Hot Encoded | `['Female', 'Male', 'Other']` (3 classes) |
| `Age` | Numeric (int) | Scaled / Standardized | `0` to `130` |
| `Number_of_Visits` | Numeric (int) | Scaled / Standardized | `>= 0` |
| `Abnormal_Result` | Categorical | One-Hot Encoded | `['Moderately Abnormal', 'Normal', 'Severely Abnormal', 'Slightly Abnormal']` (4 classes) |
| `Diagnosis` | Categorical | One-Hot Encoded | `['Acute', 'Chronic Controlled', 'Chronic Uncontrolled', 'Critical', 'Needs Follow-up', 'Stable']` (6 classes) |
| `Symptoms` | Categorical | One-Hot Encoded | `['Abdominal Pain', 'Bleeding', 'Chest Pain', 'Confusion', 'Cough', 'Dizziness', 'Fatigue', 'Fever', 'Headache', 'Nausea', 'None/Mild', 'Severe Pain', 'Shortness of Breath', 'Vomiting', 'Weakness']` (15 classes) |
| `Days_Since_Last_Visit`| Numeric (int) | Scaled / Standardized | `>= 0` |

### 3.3 Target Variable
- **Target Name:** `Priority_Score`
- **Type:** Integer (1, 2, 3, 4, 5)
- **Model Method Requirements:** Must support both `.predict()` and `.predict_proba()` with `.classes_` exposing `[1, 2, 3, 4, 5]`.

### 3.4 API Request & Response Schemas (Pydantic & JSON)

#### Request Schema (`PatientPriorityRequest`):
```python
class PatientPriorityRequest(BaseModel):
    patient_id: str = Field(min_length=1, max_length=30)
    Disease: str = Field(min_length=1, max_length=120)
    Severity: int = Field(ge=1, le=5)
    Gender: str = Field(min_length=1, max_length=30)
    Age: int = Field(ge=0, le=130)
    Number_of_Visits: int = Field(ge=0)
    Abnormal_Result: str = Field(min_length=1, max_length=80)
    Diagnosis: str = Field(min_length=1, max_length=120)
    Symptoms: str = Field(min_length=1, max_length=200)
    Days_Since_Last_Visit: int = Field(ge=0)
```

#### Request JSON Payload Example:
```json
{
  "patient_id": "PAT000003",
  "Disease": "Asthma",
  "Severity": 3,
  "Gender": "Male",
  "Age": 42,
  "Number_of_Visits": 4,
  "Abnormal_Result": "Moderately Abnormal",
  "Diagnosis": "Acute",
  "Symptoms": "Shortness of Breath",
  "Days_Since_Last_Visit": 12
}
```

#### Response JSON Payload Example:
```json
{
  "patient_id": "PAT000003",
  "prediction": 4,
  "probabilities": {
    "1": 0.05,
    "2": 0.10,
    "3": 0.25,
    "4": 0.55,
    "5": 0.05
  },
  "advisory": "Operational decision support only; not a medical diagnosis or guaranteed clinical decision."
}
```

---

## 4. Model 2: Patient Wait-Time Regressor

### 4.1 Objective
Predict the anticipated waiting time (in minutes) for an outpatient visit before consultation, accounting for patient clinical complexity, symptom count, and chronic conditions.

### 4.2 Feature Specification & Schema
The model must accept exactly **8 input features** in the specified order:

| Feature Name | Type | Processing | Valid Domain / Range / Categories |
|---|---|---|---|
| `Disease` | Categorical | One-Hot Encoded | `['Allergy', 'Arthritis', 'Asthma', 'Back Pain', 'Bronchitis', 'Common Cold', 'Diabetes', 'Flu', 'Gastritis', 'Heart Disease', 'Hypertension', 'Migraine', 'Pneumonia', 'Skin Infection', 'Urinary Tract Infection']` (15 classes) |
| `Gender` | Categorical | One-Hot Encoded | `['Female', 'Male', 'Other']` (3 classes) |
| `Age` | Numeric (int) | Scaled / Identity | `0` to `130` |
| `Number_of_Visits` | Numeric (int) | Scaled / Identity | `>= 0` |
| `Abnormal_Result` | Categorical | One-Hot Encoded | `['No', 'Yes']` (2 classes) |
| `Symptom_Count` | Numeric (int) | Scaled / Identity | `>= 0` |
| `Chronic_Condition`| Categorical | One-Hot Encoded | `['No', 'Yes']` (2 classes) |
| `Severity_Score` | Numeric (int) | Scaled / Identity | `1` to `5` (inclusive) |

> [!IMPORTANT]
> **Key Category Difference to Note:**
> Notice that `Abnormal_Result` in the Wait-Time model is binary (`['No', 'Yes']`), whereas in the Priority model it is multi-level (`['Moderately Abnormal', 'Normal', 'Severely Abnormal', 'Slightly Abnormal']`). Do not mix these up during preprocessing.

### 4.3 Target Variable
- **Target Name:** `Wait_Time` (or `Estimated_Wait_Minutes`)
- **Type:** Float / Non-negative continuous
- **Model Method Requirements:** Must support `.predict()`. Values returned are capped at `>= 0.0` by the backend.

### 4.4 API Request & Response Schemas (Pydantic & JSON)

#### Request Schema (`WaitTimeRequest`):
```python
class WaitTimeRequest(BaseModel):
    patient_id: str = Field(min_length=1, max_length=30)
    Disease: str = Field(min_length=1, max_length=120)
    Gender: str = Field(min_length=1, max_length=30)
    Age: int = Field(ge=0, le=130)
    Number_of_Visits: int = Field(ge=0)
    Abnormal_Result: str = Field(min_length=1, max_length=80)
    Symptom_Count: int = Field(ge=0)
    Chronic_Condition: str = Field(min_length=1, max_length=30)
    Severity_Score: int = Field(ge=1, le=5)
```

#### Request JSON Payload Example:
```json
{
  "patient_id": "PAT000003",
  "Disease": "Asthma",
  "Gender": "Male",
  "Age": 42,
  "Number_of_Visits": 4,
  "Abnormal_Result": "Yes",
  "Symptom_Count": 2,
  "Chronic_Condition": "Yes",
  "Severity_Score": 3
}
```

#### Response JSON Payload Example:
```json
{
  "patient_id": "PAT000003",
  "estimated_wait_time": 38.5,
  "advisory": "Operational estimate only; actual waiting time may vary."
}
```

---

## 5. Required Pipeline Architecture & Packaging

To ensure seamless integration with `Backend/app/services/ai_service.py`, both models **must** be packaged as scikit-learn `Pipeline` objects with specific internal step names.

### 5.1 Pipeline Structure Requirements
1. **Named Step `preprocessor`:**
   A `ColumnTransformer` containing:
   - `num` transformer for numeric columns (e.g. `StandardScaler` or `Pipeline([('scaler', StandardScaler())])`).
   - `cat` transformer for categorical columns (e.g. `Pipeline([('onehot', OneHotEncoder(handle_unknown='ignore'))])`).
2. **Estimator Step:**
   - Named `'classifier'` for Priority (e.g. `RandomForestClassifier`).
   - Named `'regressor'` or `'model'` for Wait-Time (e.g. `RandomForestRegressor`).
3. **Preserve `feature_names_in_`:**
   Fitting the pipeline on a Pandas DataFrame preserves `feature_names_in_`, which the backend relies on to align input columns before prediction.

### 5.2 Python & Library Environment
Ensure your local training environment uses compatible library versions matching the CARE-OS production runtime:
- **Python:** `3.12.x` or `3.14.x`
- **scikit-learn:** `1.6.1`
- **joblib:** `1.4.2`
- **pandas:** `3.0.x`
- **numpy:** `^1.26.0` or `^2.0.0`

---

## 6. End-to-End Training Script Template for Jenil

Here is a turnkey reference implementation showing how to train, evaluate, and export both pipelines:

```python
"""
train_careos_models.py
ML Model Training Script for CARE-OS
Author: Jenil
"""

from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import classification_report, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# Artifact output directory
OUTPUT_DIR = Path("AI:ML")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# -----------------------------------------------------------------------------
# 1. TRAIN PATIENT PRIORITY MODEL
# -----------------------------------------------------------------------------
def train_priority_model(dataset_path: str):
    print("--> Training Patient Priority Classifier...")
    df = pd.read_csv(dataset_path)

    numeric_features = ["Severity", "Age", "Number_of_Visits", "Days_Since_Last_Visit"]
    categorical_features = ["Disease", "Gender", "Abnormal_Result", "Diagnosis", "Symptoms"]
    target = "Priority_Score"

    X = df[categorical_features + numeric_features]
    y = df[target].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    numeric_transformer = Pipeline([
        ("scaler", StandardScaler())
    ])

    categorical_transformer = Pipeline([
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ]
    )

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", RandomForestClassifier(
            n_estimators=150,
            max_depth=12,
            random_state=42,
            class_weight="balanced"
        )),
    ])

    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    print("Priority Model Evaluation:\n", classification_report(y_test, y_pred))

    model_path = OUTPUT_DIR / "patient_priority_rf_model.joblib"
    joblib.dump(pipeline, model_path)
    print(f"Saved Priority Model to: {model_path}\n")


# -----------------------------------------------------------------------------
# 2. TRAIN PATIENT WAIT-TIME MODEL
# -----------------------------------------------------------------------------
def train_wait_time_model(df_wait_time: pd.DataFrame):
    print("--> Training Patient Wait-Time Regressor...")
    numeric_features = ["Age", "Number_of_Visits", "Symptom_Count", "Severity_Score"]
    categorical_features = ["Disease", "Gender", "Abnormal_Result", "Chronic_Condition"]
    target = "Wait_Time"

    X = df_wait_time[categorical_features + numeric_features]
    y = df_wait_time[target].astype(float)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    numeric_transformer = StandardScaler()
    categorical_transformer = Pipeline([
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, numeric_features),
            ("cat", categorical_transformer, categorical_features),
        ]
    )

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("regressor", RandomForestRegressor(
            n_estimators=150,
            max_depth=10,
            random_state=42
        )),
    ])

    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    print(f"Wait-Time Model MAE: {mae:.2f} mins, R2 Score: {r2:.3f}")

    model_path = OUTPUT_DIR / "patient_wait_time_model.joblib"
    joblib.dump(pipeline, model_path)
    print(f"Saved Wait-Time Model to: {model_path}\n")


# -----------------------------------------------------------------------------
# 3. SYNTHETIC WAIT-TIME DATA GENERATOR (IF RE-TRAINING FROM SCRATCH)
# -----------------------------------------------------------------------------
def generate_synthetic_wait_time_dataset(n_samples: int = 1000) -> pd.DataFrame:
    """Generates synthetic training records matching the required Wait-Time schema."""
    rng = np.random.default_rng(42)
    diseases = [
        "Allergy", "Arthritis", "Asthma", "Back Pain", "Bronchitis",
        "Common Cold", "Diabetes", "Flu", "Gastritis", "Heart Disease",
        "Hypertension", "Migraine", "Pneumonia", "Skin Infection", "Urinary Tract Infection"
    ]
    genders = ["Female", "Male", "Other"]
    yes_no = ["No", "Yes"]

    data = {
        "Disease": rng.choice(diseases, size=n_samples),
        "Gender": rng.choice(genders, size=n_samples, p=[0.49, 0.49, 0.02]),
        "Age": rng.integers(1, 95, size=n_samples),
        "Number_of_Visits": rng.integers(0, 15, size=n_samples),
        "Abnormal_Result": rng.choice(yes_no, size=n_samples, p=[0.7, 0.3]),
        "Symptom_Count": rng.integers(1, 8, size=n_samples),
        "Chronic_Condition": rng.choice(yes_no, size=n_samples, p=[0.65, 0.35]),
        "Severity_Score": rng.integers(1, 6, size=n_samples),
    }
    df = pd.DataFrame(data)

    # Base wait time formula + noise:
    base_wait = 15.0
    severity_factor = df["Severity_Score"] * 8.0
    abnormal_factor = (df["Abnormal_Result"] == "Yes").astype(int) * 12.0
    symptom_factor = df["Symptom_Count"] * 3.5
    chronic_factor = (df["Chronic_Condition"] == "Yes").astype(int) * 6.0
    noise = rng.normal(0, 4, size=n_samples)

    df["Wait_Time"] = np.clip(
        base_wait + severity_factor + abnormal_factor + symptom_factor + chronic_factor + noise,
        5.0,
        180.0
    ).round(1)

    return df


if __name__ == "__main__":
    # 1. Train Priority Model from existing dataset:
    train_priority_model("Dataset/patient_priority_dataset_500.csv")

    # 2. Train Wait-Time Model:
    df_wait = generate_synthetic_wait_time_dataset(n_samples=1200)
    train_wait_time_model(df_wait)
```

---

## 7. How the Frontend (CareAI) Consumes These Models

Understanding how the frontend interacts with your models helps ensure seamless end-to-end UX:

1. **Dynamic Schema Retrieval (`GET /api/v1/ai/schema`):**
   - On page load, `CareAI.jsx` calls `/api/v1/ai/schema`.
   - The backend introspects your fitted `OneHotEncoder` categories and returns them as JSON.
   - The UI dynamically populates dropdowns (Diseases, Symptoms, Diagnoses) directly from your model's categories. This guarantees the user can only select values that your model actually knows how to encode!

2. **Patient Autofill & Clinical Context:**
   - The doctor or receptionist selects an existing patient (e.g. `PAT000003`).
   - The UI auto-fills `patient_id`, `Age`, `Gender`, and recent medical history from MongoDB.
   - Any missing fields (like triage severity or current symptoms) are selected via the schema dropdowns.

3. **Inference Execution:**
   - The user clicks **Run Triage Analysis** or **Estimate Wait Time**.
   - The frontend sends `POST /api/v1/ai/patient-priority` or `POST /api/v1/ai/wait-time`.
   - The backend runs inference using your `.joblib` model and returns:
     - Priority: Predicted level (1-5), probabilities for all classes, and advisory banner.
     - Wait Time: Estimated minutes and advisory banner.

---

## 8. Cross-Platform Folder Compatibility

> [!NOTE]
> **Windows vs macOS/Linux Paths:**
> On macOS/Linux, the directory name is `AI:ML/`. However, colon `:` is an illegal character on Windows NTFS file systems.
> The CARE-OS backend automatically searches the following candidate directory names in order:
> 1. `AI:ML`
> 2. `AI_ML`
> 3. `AI-ML`
> 4. `models`
>
> If you develop or train on Windows, you can safely name your directory `AI_ML` or `models` and the backend will locate it automatically!

---

## 9. Verification & Handoff Checklist for Jenil

Before committing updated models to the repository, verify the following 3 tests:

### Step 1: Unpickle & Feature Alignment Verification
Test that both model files load into Python without warnings and have the expected feature names:
```bash
python -c "
import joblib
p = joblib.load('AI:ML/patient_priority_rf_model.joblib')
w = joblib.load('AI:ML/patient_wait_time_model.joblib')
print('Priority features:', list(p.feature_names_in_))
print('Priority classes:', list(p.classes_))
print('Wait-Time features:', list(w.feature_names_in_))
"
```

### Step 2: Backend Dynamic Schema Verification
Verify that the backend dynamic schema endpoint extracts the categorical vocabulary properly:
```bash
cd Backend
source .venv/bin/activate
python -c "
from app.services.ai_service import input_schema
schema = input_schema()
print('Priority Categoricals:', list(schema['patient_priority']['categorical'].keys()))
print('Wait Time Categoricals:', list(schema['wait_time']['categorical'].keys()))
"
```

### Step 3: Run Full Backend Test Suite
Run pytest to verify that all AI route and authorization tests pass:
```bash
pytest tests/test_authorization.py -v
```

---

## 10. Summary Checklist for Jenil
- [ ] Save models with exact filenames:
  - `AI:ML/patient_priority_rf_model.joblib`
  - `AI:ML/patient_wait_time_model.joblib`
- [ ] Use `OneHotEncoder(handle_unknown="ignore")` inside a named transformer `'cat'` under a `ColumnTransformer` named `'preprocessor'`.
- [ ] Name estimator step `'classifier'` for priority and `'regressor'` for wait-time.
- [ ] Ensure all 9 priority features and 8 wait-time features match exact case and spelling.
- [ ] Ensure priority output classes are `[1, 2, 3, 4, 5]`.
- [ ] Ensure wait-time regression output is non-negative continuous (minutes).
- [ ] Validate that artifacts unpickle cleanly under `scikit-learn 1.6.1` and `joblib 1.4.2`.

