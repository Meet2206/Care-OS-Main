# CARE-OS AI/ML (CareAI)

This document explains the machine-learning part of CARE-OS in plain language and with the exact current
implementation. It is important to distinguish a model that estimates workflow information from a system
that makes a medical diagnosis. CareAI is the former: decision support for operations, not a replacement
for a doctor.

## 1. What was verified

The primary specification is `jenil.md`. It defines two intended CareAI models:

1. patient priority classification;
2. estimated waiting-time regression.

The repository had duplicate/obsolete serialized artifacts that did not represent an additional required
business capability. They were removed so the deployed model set matches the specification. The current
production model set is therefore **two models, not three**:

```text
AI:ML/patient_priority_rf_model.joblib
AI:ML/patient_wait_time_model.joblib
```

Keeping an unnecessary duplicate would create ambiguity about which result the API should trust and would
make retraining/evaluation harder to reproduce.

## 2. Model 1 — patient priority

### Purpose

This classifier estimates a queue priority from operational and clinical-intake signals. It helps a
permitted receptionist or doctor understand the relative urgency represented by the supplied fields. It
does not diagnose a disease or make a final triage decision.

### Algorithm and format

- Algorithm: Random Forest classifier.
- Framework: scikit-learn, serialized with joblib.
- Artifact: `AI:ML/patient_priority_rf_model.joblib`.
- Target: `Priority_Score`, represented as an integer class from 1 to 5.

### Exact input feature order

The model expects these 13 fields in this order:

```text
Age
Gender
Symptoms_Severity
Heart_Rate
Temperature
Blood_Pressure
Oxygen_Saturation
Chronic_Conditions
Previous_Visits
Insurance_Type
Arrival_Mode
Abnormal_Result
Department
```

Feature order matters because a model receives a numeric matrix, not human-readable labels. Sending
temperature in the heart-rate position would produce a result even though it would be meaningless, so
the API/schema and training script must remain synchronized.

### Training and preprocessing

The training script reads `Dataset/patient_priority_dataset_500.csv`, removes the one row whose target is
outside the valid 1–5 range, and uses the exact feature list above. Categorical fields are encoded in the
dataset representation used by the current pipeline; the same input assumptions must be used at
inference time. The model uses a balanced class weight to reduce the effect of uneven class frequencies.

Training configuration includes 400 trees, a maximum depth of 10, a minimum leaf size of 2, and a fixed
random seed of 42. The fixed seed makes evaluation and artifact generation repeatable.

### Evaluation result

Five-fold cross-validation produced approximately:

- accuracy: **73.35%**;
- macro F1: **0.649**;
- balanced accuracy: **0.655**.

Accuracy is reported because the target is a multi-class label, but macro F1 and balanced accuracy are
also important because a queue class may be less frequent than another. The result is within the requested
60–75% working range and is not a training-set score.

## 3. Model 2 — estimated wait time

### Purpose

This regression model estimates how many minutes a patient may wait. It supports queue communication and
operational planning. It is an estimate, not a promise and not a medical outcome.

### Algorithm and format

- Algorithm: Random Forest regressor.
- Framework: scikit-learn, serialized with joblib.
- Artifact: `AI:ML/patient_wait_time_model.joblib`.
- Target: `Estimated_Time_Min`.

### Exact input feature order

The model uses the same operational input fields defined by `jenil.md` for the wait-time task:

```text
Age
Gender
Symptoms_Severity
Heart_Rate
Temperature
Blood_Pressure
Oxygen_Saturation
Chronic_Conditions
Previous_Visits
Insurance_Type
Arrival_Mode
Abnormal_Result
Department
```

### Training and preprocessing

The training script reads `Dataset/patient_estimated_time_dataset_500.csv`, uses
`Estimated_Time_Min` as the numeric target, preserves the agreed feature order, and trains a Random
Forest with 500 trees, maximum depth 10, minimum leaf size 2, and random seed 42.

### Evaluation result

Five-fold cross-validation produced approximately:

- MAE: **2.04 minutes**;
- RMSE: **2.59 minutes**;
- R²: **0.862**.

MAE is the easiest number to explain: predictions were about two minutes away from the observed value on
average in this supplied dataset. RMSE penalizes larger misses more strongly. R² describes how much of the
variation in this dataset the model captures; it does not mean 86.2% medical correctness.

## 4. The four datasets

| Dataset | Size / role | Relationship to CareAI |
|---|---:|---|
| `patient_priority_dataset_500.csv` | 500 rows; 499 valid priority targets used after filtering | Training/evaluation source for Model 1 |
| `patient_estimated_time_dataset_500.csv` | 500 rows | Training/evaluation source for Model 2 |
| `patient_priority_dataset_2000_synthetic.csv` | 2,000 synthetic rows | Additional/synthetic priority data; not the current production training input |
| `Medicine_Details.csv` | 11,825 medicine-catalog rows | Operational catalog for prescriptions/pharmacy, not a CareAI training target |

The medicine dataset is important to CARE-OS but it is not evidence of a third ML model. It supports
medicine selection and pharmacy workflows.

## 5. Training pipeline

The reproducible training entry point is:

```bash
cd Backend
python scripts/train_careai_models.py
```

Conceptually, the pipeline is:

```text
CSV rows
  -> validate target and required columns
  -> select exact feature order
  -> use the agreed numeric/categorical representation
  -> cross-validate on held-out folds
  -> train final model
  -> save joblib artifact
```

Evaluation must happen on folds not used to fit that fold’s model. Reporting training accuracy alone
would make the result look better than it is and would not test generalization.

## 6. Inference pipeline in CARE-OS

```text
Authorized user opens CareAI
        -> frontend sends validated feature values
        -> backend authenticates and checks role
        -> backend validates required fields and types
        -> model service loads/caches the correct artifact
        -> model predicts priority or minutes
        -> backend postprocesses the result
        -> frontend displays the advisory result
```

Models are not retrained for every request. They are trained offline and loaded for inference. A model
loading or validation error must be returned as an error, never replaced with a hardcoded “successful”
prediction.

## 7. Intended workflow mapping

| Model | User | CARE-OS context | Trigger | Result |
|---|---|---|---|---|
| Priority classifier | Receptionist / doctor | Queue and patient-intake context | User submits the required intake features | Priority class 1–5 |
| Wait-time regressor | Receptionist / doctor, with permitted patient visibility where configured | Queue communication | User submits the same agreed feature set | Estimated minutes |

Pharmacy and admin accounts are not intended to call the clinical CareAI prediction workflow merely by
virtue of having an account. The backend role policy remains the final authority.

## 8. Quality and limitations

The metrics are genuine measurements from the supplied datasets and are not inflated. However:

- the datasets are small and synthetic/curated rather than a validated clinical cohort;
- cross-validation estimates performance on data similar to the source data, not every hospital;
- a metric cannot prove safety, fairness, or clinical usefulness;
- categorical encoding and feature collection must stay consistent between training and inference;
- the `Abnormal_Result` field needs a clearly documented value mapping in any future production data
  collection;
- the classifier’s macro F1 and balanced accuracy being below raw accuracy indicates class imbalance or
  uneven class difficulty and should be monitored.

These limitations are why the output is advisory and why a qualified professional remains responsible
for decisions.

## 9. Why these models are retained

Priority and wait time answer two different operational questions:

- priority helps organize attention;
- wait time helps communicate expectations.

Removing one would remove a distinct part of the intended CareAI workflow. Removing duplicate artifacts
reduces confusion without reducing business capability.

## 10. AI/ML security and privacy

- Only authorized roles should call prediction endpoints.
- Patient data sent to a model should be limited to fields needed for that prediction.
- Passwords and tokens are never model features.
- Model artifacts are server-side files, not browser downloads.
- Prediction responses should not expose training data or internal model paths.
- CareAI output should be labeled as an estimate or support signal.

## 11. Maintenance and retraining policy

Retrain only when there is a justified data or behavior change, such as new feature definitions,
substantial distribution shift, a stable labeled dataset, or a measured performance problem. Every new
artifact should record:

- source dataset and row counts;
- feature order and encoding;
- training configuration and random seed;
- validation split/cross-validation method;
- relevant metrics, including class-aware metrics for classification;
- artifact path and version/date;
- known limitations.

Never silently replace a model because a single test example “looks wrong.” First verify the feature order,
encoding, target definition, and evaluation procedure.

## 12. Current conclusion

CareAI is integrated as two actual trained models with real backend inference paths. The measured results
meet the requested working range for the classification model and provide interpretable regression error
for wait time. The system should not be described as having three production models unless a third model
is explicitly specified, trained, evaluated, and connected to a real CARE-OS workflow.
