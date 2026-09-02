# CARE-OS System Logic Reference

This document explains the current CARE-OS implementation: its architecture, data flow, security rules, clinical workflows, AI integration, pharmacy workflow, frontend behavior, configuration, and operational limits.

## 1. System purpose

CARE-OS is a role-based clinical operations application. The current system supports:

- Authentication with JWTs and four application roles.
- Patient, doctor, appointment, and medical-record management.
- Doctor prescriptions using the medicine catalog.
- Automatic pharmacy-order creation and pharmacy status processing.
- Patient-visible order status.
- CareAI priority and wait-time predictions.
- Operational reports, dashboards, files, notifications, billing, and audit-log modules.

The frontend is the existing CARE-OS user experience. The backend is authoritative for identity, relationships, permissions, persistence, prescriptions, pharmacy orders, and AI access.

## 2. Repository layout

```text
/Frontend      React/Vite user interface
/Backend       FastAPI application and MongoDB services
/AI/ML         Serialized machine-learning model artifacts when present
/Dataset       Clinical and medicine CSV datasets
```

Important current files:

- Frontend entry: `Frontend/src/main.jsx`
- Frontend routing: `Frontend/src/App.jsx`
- Frontend API client: `Frontend/src/api/client.js`
- Frontend authentication: `Frontend/src/context/AuthContext.jsx`
- Backend entry: `Backend/main.py`
- Backend settings: `Backend/app/config/settings.py`
- Backend security: `Backend/app/utils/security.py`
- MongoDB connection: `Backend/app/database/mongodb.py`

## 3. High-level architecture

```text
React/Vite frontend
        |
        | HTTPS/HTTP JSON with Bearer JWT
        v
FastAPI routes
        |
        +--> authentication and role authorization
        +--> controllers
        +--> domain services
        +--> MongoDB collections and indexes
        +--> AI model service
        +--> medicine CSV catalog
```

The frontend never directly reads MongoDB, model files, passwords, or model internals. It calls the
centralized API client, which attaches the access token from browser local storage. A `401` from any
call clears the token and returns the user to the sign-in screen.

Two middlewares wrap every request: one applies response hardening headers, the other records an
audit entry for authenticated access to clinical and administrative resources.

## 4. Frontend logic

### 4.1 Application startup and routing

`Frontend/src/main.jsx` mounts the React application. `App.jsx` defines routes for login, dashboards, CareAI, patients, records, and related pages.

`AuthContext` restores the session by calling `/api/v1/auth/me` when a token exists. If the token is invalid or expired, it clears the token and returns the user to authentication.

`ProtectedRoute` prevents unauthenticated access **and** checks the signed-in role against the route
being opened, redirecting to the user's own dashboard otherwise. `RoleRedirect` chooses the dashboard
based on the backend role. The role is not inferred from a frontend hardcoded account. These checks
are for navigation; the backend remains authoritative and enforces the same boundaries.

### 4.2 API client

`Frontend/src/api/client.js`:

1. Reads `VITE_API_BASE_URL`, defaulting to `http://localhost:8000/api/v1`.
2. Adds `Authorization: Bearer <token>` when a token exists.
3. Serializes JSON request bodies.
4. Parses JSON or text responses.
5. Throws an error for non-2xx responses, preserving the HTTP status and backend payload.

The frontend should use `apiRequest()` instead of scattering direct `fetch()` calls.

### 4.3 Frontend source-of-truth rule

The current integrated clinical and pharmacy workflows use backend data:

- Doctor patients, appointments, records, prescriptions, and medicines.
- Pharmacy orders and status actions.
- Patient pharmacy orders.
- CareAI patient context and predictions.

`Frontend/src/data/mockData.js` still supplies presentation-only copy on the patient and pharmacy
dashboards (care-team contacts, assistance options, counter alerts, slot availability). It is not
used by any clinical decision or write path. The admin overview and the medical-records browser now
read live API data.

## 5. Roles and permissions

The intended roles are:

- `doctor`
- `pharmacy`
- `patient`
- `receptionist`
- `admin` is retained for administrative backend operations. The development account is `Admin@CareOS`.

### Doctor

- Can access patients linked through appointments or medical records.
- Can view doctor-scoped appointments and clinical records.
- Can create prescriptions only as the authenticated doctor.
- Can search medicines.
- Can request AI predictions for linked patients.
- Cannot modify pharmacy-order status.

### Pharmacy

- Can read pharmacy orders.
- Can transition orders through the pharmacy status machine.
- Cannot access AI.
- Cannot modify prescriptions or medical records.
- Has **no** appointment access at all: not list, and not read, update, or delete by ID.
- Cannot create, amend, or retire a doctor.

### Patient

- Can access only resources associated with the authenticated `patient_id`.
- Appointment lists are forced to the authenticated patient ID.
- Medical-record and prescription detail access is ownership checked.
- Pharmacy-order lists are filtered by ownership server-side.
- Cannot modify pharmacy-order status.
- Can request AI predictions only for the linked patient record.

### Receptionist

- Can register and list patients.
- Retains operational appointment access.
- Can create appointments through the supported workflow.
- Can use AI where the existing policy permits.
- Does not receive doctor-only clinical mutation permissions.

### Admin

Administrative routes preserve appropriate broad operational access: dashboards, reports, the patient
registry, the doctor directory, billing, notifications, files, and the audit trail. Admin is the only
role that may create accounts, create or retire doctors, void bills, or read the audit log.

Admin deliberately does **not** have clinical-record read access; `/medical-records` remains scoped
to the treating doctor and the patient. Oversight is served by the reports module instead.

Admin behaviour is controlled by backend role dependencies, not frontend visibility alone.

## 6. Authentication logic

Login endpoint:

```text
POST /api/v1/auth/login
```

Request:

```json
{
  "login_id": "DoctorMeet@CareOS",
  "password": "..."
}
```

The backend:

1. Finds the active user by unique `login_id`.
2. Verifies the password against its secure hash.
3. Creates a JWT signed with the environment-configured secret.
4. Returns the token and sanitized user information.

The token identity is resolved from the database on protected requests. Inactive or deleted users are rejected even if an old token exists.

Demo accounts are seeded **only** when `ENVIRONMENT=development` and `SEED_DEMO_USERS=true`. The
settings model refuses to load if seeding is enabled in any other environment, or if `SECRET_KEY` is
shorter than 32 characters outside development. No password appears in source: it comes from
`DEMO_USER_PASSWORD`, or is generated per process and written to the startup log.

Repeated failed sign-ins are throttled per login ID and per client address, returning `429` with
`Retry-After`. Passwords are stored as bcrypt hashes and are never returned by APIs or logged.
`POST /auth/change-password` lets a user rotate their own password; system-generated patient
accounts are flagged `must_change_password` and the UI blocks until that is done.

## 7. Backend request flow

The backend follows a route/controller/service pattern:

```text
HTTP request
  -> route dependency and validation
  -> controller error translation
  -> domain service
  -> MongoDB
  -> response schema
```

Pydantic schemas validate request and response shapes. Services implement identifiers, relationships, indexes, conflict rules, and persistence. Controllers translate domain exceptions into HTTP responses.

## 8. Core data model

### Users

Stores login identity, password hash, role, status, and optional links such as `doctor_id` or `patient_id`.

### Doctors

Stores doctor profile, department, specialization, license, contact information, availability, and status.

### Patients

Stores patient identity, demographics, contact information, blood group, allergies, medical history, and status.

### Appointments

Stores:

- `appointment_id`
- `patient_id`
- `doctor_id`
- date and time
- appointment type
- reason and notes
- status

Appointment authorization is scoped by authenticated patient or doctor where applicable.

### Medical records

Stores:

- `record_id`
- `appointment_id`
- `patient_id`
- `doctor_id`
- diagnosis
- symptoms
- vital signs
- treatment
- notes
- follow-up date

Medical records must be linked to real appointments, patients, and doctors.

### Prescriptions

A prescription is the clinical source. It stores:

- `prescription_id`
- `medical_record_id`
- `appointment_id`
- `patient_id`
- `doctor_id`
- medicines

Each medicine contains `medicine_id`, name, dosage, frequency, duration, and instructions. One active prescription is allowed per medical record.

### Pharmacy orders

A pharmacy order is the operational processing record. It references the prescription rather than duplicating the clinical source unnecessarily.

It stores:

- `order_id`
- `prescription_id`
- `patient_id`
- `doctor_id`
- optional `pharmacy_id`
- medicine snapshots
- status and lifecycle timestamps

The `prescription_id` is unique, preventing duplicate orders for one prescription.

## 9. Clinical workflow logic

### Patient registration

Receptionist submits a validated `PatientCreate` payload. The patient service generates a real `patient_id`, validates email/phone/enums, writes the document, and returns the persisted record.

### Appointment creation

An appointment references existing patient and doctor IDs. The service validates related records and prevents doctor schedule conflicts.

### Medical-record creation

A medical record references a real appointment, patient, and doctor. The service prevents duplicate records for the same appointment and validates relationships.

### Prescription creation

The doctor submits a prescription using IDs obtained from backend clinical data. The backend:

1. Requires the `doctor` role.
2. Requires request `doctor_id` to match the authenticated doctor.
3. Validates that medical record, appointment, patient, and doctor exist.
4. Validates that the record and appointment all refer to the same patient and doctor.
5. Enforces one active prescription per medical record.
6. Persists the prescription.
7. Creates or reuses exactly one pharmacy order.

React does not create pharmacy orders.

## 10. Pharmacy workflow logic

Status values are controlled:

```text
PENDING -> ACCEPTED -> PACKED -> DISPENSED
       \-> CANCELLED
ACCEPTED -> CANCELLED
```

Terminal states are `DISPENSED` and `CANCELLED`. Invalid transitions return `409 Conflict`.

The pharmacy dashboard loads `/api/v1/pharmacy-orders`, maps backend records to the existing visual components, and sends PATCH requests for status actions. It does not persist orders to localStorage.

The patient dashboard reads the same backend order resource, but the backend filters the list to the authenticated patient.

## 11. Medicine catalog logic

`Dataset/Medicine_Details.csv` is exposed through the doctor-only endpoint:

```text
GET /api/v1/medicines/search?q=<text>&limit=<n>
```

The endpoint reads medicine names and compositions from the catalog. It returns deterministic catalog IDs such as `MED000002`. Medicine catalog data is not copied into React hardcoded options.

## 12. CareAI logic

CareAI uses:

```text
POST /api/v1/ai/patient-priority
POST /api/v1/ai/wait-time
```

Backend AI access allows doctor, receptionist, and patient roles according to route policy. Pharmacy is rejected.

Patient ownership is enforced server-side. Doctors must have a linked appointment or medical record for the requested patient.

### Priority input assembly

- Gender: patient record.
- Age: calculated from patient date of birth (full date arithmetic, not a year subtraction).
- Number of visits: linked appointments.
- Days since last visit: latest appointment date.
- Disease, Severity, Abnormal_Result, Diagnosis, Symptoms: chosen by the user from the model's own
  training vocabulary, served by `GET /ai/schema`.

Diagnosis and Symptoms are **not** taken from the medical-record free text. Both are 6- and 15-value
controlled vocabularies in the training data, so free text encodes to an all-zero vector and the
prediction silently stops depending on it.

### Wait-time input assembly

- Gender, age, and visit count: backend patient/appointment data.
- Disease, Abnormal_Result, Chronic_Condition: chosen from this model's own vocabulary. Note that
  `Abnormal_Result` is Yes/No here but a four-level ordinal in the priority model; the two are
  separate fields in the UI for that reason.
- Symptom_Count and Severity_Score: entered numerically. Severity_Score is limited to 1-5, the
  trained range.

The frontend does not fabricate missing clinical values, expose model paths, or present predictions as diagnoses.

## 13. API groups

Current major API groups under `/api/v1`:

```text
/auth
/patients
/doctors
/appointments
/medical-records
/prescriptions
/pharmacy-orders
/medicines
/ai
/dashboard
/reports
/notifications
/billing
/files
/audit-logs
/db-test
```

Health endpoint:

```text
GET /health
```

## 14. Configuration and runtime

Backend configuration is environment-based. The local development configuration uses:

```text
MONGODB_URI=mongodb://localhost:27017/
DATABASE_NAME=care_os
```

Other required settings include host, port, secret key, algorithm, CORS origins, and AI model directory. Use `Backend/.env.example` as the safe template. Never commit a real `.env` file or secrets.

Typical backend startup:

```bash
cd Backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Typical frontend startup:

```bash
cd Frontend
npm install
npm run dev
```

## 15. Indexing and idempotency

Backend startup creates indexes for the active domain collections. Important uniqueness rules include:

- unique user login ID
- unique doctor ID
- unique patient ID
- unique appointment ID
- unique medical-record ID
- unique prescription ID
- unique prescription per medical record
- unique pharmacy order ID
- unique pharmacy order per prescription

Demo-user and clinical-data seed operations are designed to be idempotent. Pharmacy-order creation is also idempotent by `prescription_id`.

## 16. Error behavior

Common response meanings:

- `401`: missing, invalid, or expired authentication.
- `403`: authenticated but unauthorized role or ownership.
- `404`: resource or relationship does not exist.
- `409`: conflict such as duplicate record or invalid workflow transition.
- `422`: request validation failure.
- `429`: too many failed sign-in attempts; `Retry-After` gives the wait in seconds.
- `503`: AI model unavailable.

Frontend error states should display safe user-facing messages and never reveal secrets, model paths, stack traces, or database credentials.

## 17. Known implementation boundaries

- Presentation-only copy on the patient and pharmacy dashboards is still static (care-team contacts,
  assistance options, counter alerts, slot availability). No clinical or write path depends on it.
- The demo accounts are linked to clinical records by `Backend/scripts/seed_demo_clinical_data.py`,
  which must be run explicitly. Newly registered patients get their own linked login automatically.
- AI fields absent from the clinical schema are supplied explicitly by the user from the model's
  vocabulary; they are never inferred from medicine names or unrelated fields.
- Login throttling is in-process. A multi-worker or multi-instance deployment needs a shared store
  (Redis) behind `app/utils/rate_limit.py`; the interface is deliberately small so the swap is local.
- Appointment slot availability shown to patients is presentational; the authoritative conflict check
  is the unique index on doctor/date/time, which returns `409`.
- The project targets a local MongoDB. Deployment packaging (containers, TLS termination, migrations,
  a shared rate-limit store) is not included.

## 18. Verification reference

The integrated system has been live-tested for:

- all four demo-account logins
- patient registration
- patient → appointment → medical record
- doctor → prescription
- prescription → pharmacy order
- pharmacy status lifecycle
- patient order visibility
- CareAI priority and wait-time predictions
- ownership and role attacks
- backend restart persistence
- frontend build and ESLint
