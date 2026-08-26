# CARE-OS Complete Technical Reference

This file is a developer handoff for the current CARE-OS implementation. It documents the architecture, modules, data contracts, algorithms, authorization rules, frontend behavior, AI integration, and operational workflow.

## 1. Product and architecture

CARE-OS is a role-based healthcare operations system:

```text
Frontend (React + Vite)
        |
        | JSON over HTTP with Bearer JWT
        v
Backend (FastAPI)
        |
        +--> MongoDB: care_os
        +--> Medicine_Details.csv catalog
        +--> AI model service
```

The frontend is the authoritative UI. The backend is authoritative for identity, permissions, clinical relationships, persistence, pharmacy transitions, and AI access. The frontend never connects directly to MongoDB or model files.

Repository areas:

| Area | Responsibility |
|---|---|
| `Frontend/` | React pages, routing, components, API client, session state |
| `Backend/` | FastAPI routes, schemas, controllers, services, security |
| `AI/ML/` | Serialized priority and wait-time models when present |
| `Dataset/` | Patient/medicine datasets and medicine catalog |

Main entry points:

- Frontend: `Frontend/src/main.jsx`
- Frontend routes: `Frontend/src/App.jsx`
- Frontend API client: `Frontend/src/api/client.js`
- Frontend auth: `Frontend/src/context/AuthContext.jsx`
- Backend: `Backend/main.py`
- Backend settings: `Backend/app/config/settings.py`
- MongoDB: `Backend/app/database/mongodb.py`
- Security: `Backend/app/utils/security.py`

## 2. Backend request lifecycle

```text
HTTP request
  -> CORS middleware
  -> JWT/role/ownership dependency
  -> Pydantic request validation
  -> route
  -> controller
  -> domain service
  -> MongoDB or catalog/model adapter
  -> Pydantic response schema
```

Routes handle transport and authorization dependencies. Controllers translate domain exceptions into HTTP errors. Services implement business rules, indexes, identifiers, filtering, and persistence. Schemas define input/output contracts. Models contain collection names and document conversion helpers.

## 3. Configuration and database

Configuration is loaded from `Backend/.env` through `app/config/settings.py`. Secrets are never hardcoded in React or Python source.

Required local configuration:

```env
HOST=127.0.0.1
PORT=8000
MONGODB_URI=mongodb://localhost:27017/
DATABASE_NAME=care_os
SECRET_KEY=<local-development-secret>
CORS_ORIGINS=http://localhost:5173
```

MongoDB is accessed through PyMongo. Startup performs a ping and creates indexes for patients, doctors, appointments, records, prescriptions, pharmacy orders, billing, notifications, users, files, and audit logs. Demo-user seeding is idempotent: existing users are not duplicated or overwritten.

## 4. Authentication and identity

`POST /api/v1/auth/login` accepts `login_id` and `password`. The service finds the active user, verifies the password hash, and signs a JWT using the environment secret. Passwords are stored only as hashes. Responses contain no password or password hash.

`GET /api/v1/auth/me` resolves the authenticated user and returns sanitized identity, role, `user_id`, and optional `patient_id`/`doctor_id` links.

Frontend session logic:

1. Login receives the access token.
2. `api/client.js` attaches it to API calls.
3. `AuthContext` restores `/auth/me` on refresh.
4. `ProtectedRoute` blocks unauthenticated pages.
5. `RoleRedirect` selects the dashboard from the backend role.
6. Logout removes the token and clears React auth state.

Development accounts:

| Login | Role | Link |
|---|---|---|
| `DoctorMeet@CareOS` | doctor | `DOCDEMO001` |
| `PharmacyMeet@CareOS` | pharmacy | pharmacy workflow |
| `PatientMeet@CareOS` | patient | linked patient record |
| `Reception@CareOS` | receptionist | operations |
| `Admin@CareOS` | admin | administration |

## 5. Roles and authorization

Backend authorization is authoritative; frontend role checks are navigation only.

### Doctor

Doctors can view patients in their clinical scope, view their appointments and records, create prescriptions using their own `doctor_id`, search medicines, and use authorized CareAI flows.

### Patient

Patients are always restricted to their authenticated `patient_id`. Query parameters cannot broaden appointment, medical-record, prescription, pharmacy-order, or AI access. Object-detail routes apply ownership checks as well as role checks.

### Pharmacy

Pharmacy users read and process pharmacy orders. They cannot access clinical records, prescriptions, CareAI, or broad appointment lists. Order status changes are validated by the pharmacy transition rules.

### Receptionist

Receptionists remain distinct from admin and doctor. They handle patient registration and operational appointment workflows but do not receive doctor-only clinical mutation permissions.

### Admin

Admin routes provide appropriate operational administration. Admin is not silently treated as receptionist, and receptionist is not silently treated as admin.

## 6. Schemas and domain models

Every schema is a Pydantic model under `Backend/app/schemas/`. Every model is a MongoDB collection/document helper under `Backend/app/models/`.

### User schema/model

Core fields include `login_id`, `user_id`, `full_name`, `role`, `password_hash`, `status`, timestamps, and optional `patient_id` or `doctor_id`. Unique indexes protect `login_id`, `user_id`, and sparse legacy email values.

### Patient schema/model

Fields:

- `patient_id`
- `full_name`, `gender`, `date_of_birth`
- `phone`, `email`, `address`
- `blood_group`
- `emergency_contact_name`, `emergency_contact_phone`
- `allergies`, `medical_history`, `status`
- optional `assigned_doctor_id`
- timestamps and soft-delete fields

Patient creation allocates a sequential `PAT######` identifier. It also generates a linked patient login using the normalized name and birth day, for example `ChandraDave@CareOS` and `ChandraDave16`. If the login exists, a numeric suffix is added. The temporary password is returned only in the creation response/success screen and is never stored in plaintext.

### Doctor schema/model

Stores `doctor_id`, name, specialization, department, license/contact information, availability, status, and timestamps. Doctor identity is linked to the authenticated user through `doctor_id`.

### Appointment schema/model

Fields:

- `appointment_id`, `patient_id`, `doctor_id`
- `appointment_date`, `appointment_time`
- `appointment_type`
- `reason`, `notes`
- status: `Scheduled`, `Completed`, `Cancelled`, or `No Show`

### Medical record schema/model

Fields:

- `record_id`, `appointment_id`, `patient_id`, `doctor_id`
- `diagnosis`, `symptoms`
- `vital_signs`: blood pressure, heart rate, temperature, respiratory rate, oxygen saturation, weight, height
- `treatment`, `notes`, `follow_up_date`

Records must be tied to real appointment/patient/doctor relationships.

### Prescription schema/model

Fields:

- `prescription_id`
- `medical_record_id`, `appointment_id`, `patient_id`, `doctor_id`
- `medicines[]`

Each medicine contains `medicine_id`, `medicine_name`, `dosage`, `frequency`, `duration`, and `instructions`. The authenticated doctor's ID is used; the frontend cannot impersonate another doctor. The service validates the linked clinical record and prevents duplicate active prescriptions for the same record.

### Pharmacy order schema/model

Fields include `order_id`, `prescription_id`, `patient_id`, `doctor_id`, optional pharmacy link, medicine snapshots, status, timestamps, and audit information.

Status algorithm:

```text
PENDING -> ACCEPTED -> PACKED -> DISPENSED
```

Invalid transitions and unauthorized role changes are rejected server-side.

### Other schemas/models

- Billing: bills, line items, totals, payment/status data.
- Notifications: recipient, title, message, type, read state, timestamps.
- Files: metadata, patient/record association, storage reference, uploader.
- Audit logs: actor, role, action, entity, entity ID, metadata, timestamp.
- Dashboard/report schemas: aggregated operational metrics and recent activity.
- AI schemas: validated model input and user-friendly prediction responses.

## 7. Backend modules

### Routes

Routes under `Backend/app/routes/`:

| Route module | Main capability |
|---|---|
| `auth.py` | login and current-user session |
| `patient.py` | patient registration, list, detail, update |
| `doctor.py` | doctor CRUD/list |
| `appointment.py` | appointment CRUD/list and scope filtering |
| `medical_record.py` | clinical record CRUD/list |
| `prescription.py` | prescription CRUD/list and ownership |
| `medicine.py` | doctor-only medicine catalog search |
| `pharmacy_order.py` | pharmacy order read/status workflow |
| `ai.py` | priority and wait-time predictions |
| `dashboard.py` | operational dashboard metrics |
| `report.py` | patient/doctor/appointment/revenue reports |
| `notification.py` | notification CRUD/list |
| `billing.py` | billing operations |
| `file_routes.py` | file upload/list/download/delete |
| `audit_log_routes.py` | audit-log access |
| `database.py` | protected database test |

### Services

Services implement the business logic for each route domain. Important algorithms include sequential patient IDs, password hashing, JWT creation/validation, unique-index creation, soft deletion, pagination, doctor/patient scoping, prescription-to-pharmacy-order creation, pharmacy status transitions, report aggregation, and AI input validation.

## 8. Frontend modules and features

### Shared frontend infrastructure

- `api/client.js`: centralized HTTP client and bearer-token handling.
- `api/auth.js`: login, `/auth/me`, logout.
- `AuthContext.jsx`: session lifecycle and role dashboard mapping.
- `ProtectedRoute.jsx`: authentication gate.
- `RoleRedirect.jsx`: role-based landing route.
- `Layout`, `Sidebar`, `Topbar`: shared application shell.
- `Button`, `Card`, `Modal`, `PageIntro`, `StatusPill`, `MetricCard`: design system primitives.

### Pages

- Login: backend authentication; no hardcoded credentials.
- Admin: operational metrics, patients, doctors, reports, billing, logs.
- Reception: patient registration, patient directory, appointments, queue actions.
- Doctor: scoped patients, appointments, medical records, medicine search, prescriptions.
- Patient: own profile, appointments, records, orders, CareAI.
- Pharmacy: order queue and status processing.
- CareAI: patient context, advisory priority/wait-time predictions, patient detail chatbot flow.

### Patient onboarding algorithm

1. Collect and validate demographics/contact data.
2. Collect medical history and medications.
3. Collect doctor assignment/appointment information in the UI.
4. Submit normalized data to `POST /api/v1/patients`.
5. Backend persists the patient, creates the linked account, and returns the real ID.
6. Success screen shows the real patient ID and one-time temporary credentials.

The frontend does not treat generated mock IDs or localStorage as the source of truth.

## 9. Doctor prescription algorithm

```text
Doctor login
  -> load doctor-scoped patients, appointments, records
  -> select a real patient
  -> resolve a real linked appointment
  -> resolve a real medical record
  -> search Medicine_Details.csv through /medicines/search
  -> select medicine_id and enter dosage/frequency
  -> POST /prescriptions with real relationship IDs
  -> backend validates doctor scope and creates prescription
  -> backend creates pharmacy order
```

The medicine dropdown is controlled by `medicine_id`; the display label is `medicine_name`. This prevents selection-state mismatches.

A prescription is intentionally rejected when the patient lacks a real appointment or medical record. This protects the clinical data model and avoids fabricated records.

## 10. Medicine catalog

`GET /api/v1/medicines/search?q=<text>&limit=<n>` is doctor-only. The backend reads `Dataset/Medicine_Details.csv`, matches medicine name or composition case-insensitively, and returns stable IDs in the form `MED######`, name, and composition. The CSV is a catalog source; prescriptions persist selected medicine IDs and snapshots.

## 11. CareAI and machine-learning algorithms

CareAI is advisory decision support and is not a diagnosis.

### Priority model contract

Required features, in model order:

```text
Disease
Severity
Gender
Age
Number_of_Visits
Abnormal_Result
Diagnosis
Symptoms
Days_Since_Last_Visit
```

### Wait-time model contract

Required features, in model order:

```text
Disease
Gender
Age
Number_of_Visits
Abnormal_Result
Symptom_Count
Chronic_Condition
Severity_Score
```

### Runtime flow

1. User selects or is linked to an authorized patient.
2. Backend checks role and patient/doctor ownership.
3. Backend loads patient, appointment, and medical-record context.
4. Input fields are assembled and validated; missing clinical data causes a clear error rather than fabricated values.
5. `ai_service.py` loads the trusted local joblib artifacts and calls the estimator.
6. Response is converted to a user-friendly priority/wait-time result.
7. Frontend presents loading, success, empty, and error states without exposing model paths, sklearn internals, feature engineering, or private probabilities.

Endpoints:

```text
POST /api/v1/ai/patient-priority
POST /api/v1/ai/wait-time
```

The serialized artifacts are not retrained or modified at runtime. Compatibility depends on the Python/joblib/scikit-learn environment used to load them.

## 12. Patient ownership algorithm

For patient users, the backend ignores caller-supplied patient IDs where necessary and replaces them with `current_user.patient_id`. Detail endpoints fetch the object, then call ownership validation. A patient changing an ID receives `403` or an empty scoped list, never another patient's protected data.

Doctor lists and details are scoped by `doctor_id`, appointments, records, and the patient's `assigned_doctor_id`. Pharmacy appointment access is denied because it is not required by the current workflow. Receptionist operational access remains available.

## 13. API examples

```text
GET  /health
POST /api/v1/auth/login
GET  /api/v1/auth/me
GET  /api/v1/patients
POST /api/v1/patients
GET  /api/v1/appointments
POST /api/v1/appointments
GET  /api/v1/medical-records
POST /api/v1/medical-records
GET  /api/v1/medicines/search
POST /api/v1/prescriptions
GET  /api/v1/pharmacy-orders
PATCH /api/v1/pharmacy-orders/{order_id}/status
POST /api/v1/ai/patient-priority
POST /api/v1/ai/wait-time
```

## 14. Run commands

MongoDB:

```bash
brew services start mongodb-community@7.0
mongosh "mongodb://localhost:27017/care_os" --quiet --eval 'db.runCommand({ping:1})'
```

Backend:

```bash
cd Backend
source .venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd Frontend
npm install
npm run dev -- --host 127.0.0.1
```

Checks:

```bash
cd Frontend && npm run lint && npm run build
cd ../Backend && python -m compileall -q app
```

## 15. Security rules

- Never commit `.env`, secrets, API keys, or production database credentials.
- Never store or log plaintext passwords.
- Never trust frontend role checks as authorization.
- Never accept a patient ID from a patient when it conflicts with the authenticated identity.
- Never let a doctor submit another doctor's ID as the acting doctor.
- Never expose model files, internal paths, or private model internals to React.
- Never fabricate clinical IDs, appointments, records, or diagnoses.
- Keep pharmacy status transitions server-side and auditable.

## 16. Known boundaries

Some presentation-only legacy sections still contain mock copy or placeholders in `Frontend/src/data/mockData.js`. The integrated authentication, patient persistence, doctor clinical workflow, medicine search, prescription, pharmacy, patient dashboard, and CareAI flows use backend data.

The complete prescription path requires a real clinical relationship chain:

```text
Patient -> Appointment -> Medical Record -> Prescription -> Pharmacy Order
```

That restriction is intentional: it prevents invalid or fabricated clinical data from entering MongoDB.
