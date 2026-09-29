# CARE-OS Backend

This document explains the server that protects data, applies business rules, connects MongoDB, and
exposes CareAI. It describes not just what the code does, but why the layers exist.

## 1. Backend purpose

The backend is the trusted coordinator of CARE-OS. It answers questions such as:

- Is this person signed in?
- Is this role allowed to perform this action?
- Does this patient belong to the requested account or clinical relationship?
- Is the submitted data complete and valid?
- Should this record be created, updated, or rejected?
- What should be returned to the browser?

The frontend can suggest an action, but only the backend can make it real.

Appointment advance payments are persisted separately from appointments. A booking remains
`Payment Pending` until the simulated 25% advance is recorded successfully; only then can the
appointment move into the confirmed scheduling flow. Payment details are validated at the boundary
and sensitive card values are not stored as plaintext.

## 2. Technology and layers

- FastAPI provides HTTP routing and automatic request/response handling.
- Pydantic schemas validate incoming and outgoing data.
- MongoDB stores document records and indexes.
- Python services hold business logic.
- Joblib loads the serialized CareAI models.
- JWT and bcrypt support authentication.

The main structure is:

```text
Backend/main.py
  -> routes
      -> controllers
          -> services
              -> models / MongoDB / CareAI
```

### Why use layers?

- **Routes** describe the public API path and required role.
- **Controllers** translate HTTP requests into application calls.
- **Schemas** reject malformed data early and document the contract.
- **Services** hold reusable rules such as patient-account creation.
- **Models/database code** handle persistence details.

Separating these responsibilities makes testing safer and prevents a single route from becoming an
unreviewable mixture of security, validation, database code, and formatting.

## 3. Startup lifecycle

`Backend/main.py` starts the FastAPI application and its lifespan process. Startup:

1. loads settings from environment variables;
2. connects to MongoDB;
3. creates required indexes;
4. removes retired demo clinical records and seeds the hospital doctor directory plus linked
   development doctor accounts when development seeding is enabled;
5. exposes the API under `/api/v1`.

Health endpoints are available at `/health` and `/ready`. Readiness is the more meaningful operational
check because it includes database availability.

## 4. Configuration

Important settings include the MongoDB URL and database name, JWT secret and expiry, CORS origins,
environment mode, and demo-user configuration. Secrets belong in environment configuration, not source
code. The local development configuration is not a production secret-management strategy.

The frontend normally calls `http://localhost:8000/api/v1`; this can be changed through the frontend API
base URL setting.

## 5. Authentication

The authentication flow is:

```text
login ID + password
       -> backend looks up account
       -> bcrypt verifies password hash
       -> backend issues signed JWT
       -> frontend sends JWT on later requests
```

The password itself is not stored. Bcrypt is intentionally slow and salted, which makes large-scale
guessing more expensive than storing a fast plain hash.

Endpoints include:

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/change-password`

New patient accounts have `must_change_password=true`. That flag is included in login and current-user
responses so the frontend can restore the first-sign-in gate after a refresh. A successful password change
updates the bcrypt hash and removes the requirement.

## 6. Authorization

The backend recognizes `admin`, `doctor`, `pharmacy`, `patient`, and `receptionist`. Authorization is
checked at API level, not only by hiding frontend navigation.

- Patients can access their own permitted records and cannot read another patient by changing an ID.
- Doctors can access records tied to their authorized appointment/clinical relationships.
- Receptionists can perform registration and coordination operations assigned to their workflow.
- Pharmacy users process pharmacy-domain data, not unrestricted clinical administration.
- Admin operations are separate from clinical authorship.

This distinction is important: authentication answers “who are you?”; authorization answers “may you do
this particular thing to this particular record?”

## 7. Patient creation implementation

`POST /api/v1/patients` accepts validated demographic and contact data, optional medical fields, and an
optional doctor assignment. The service:

1. validates the request with `PatientCreate`;
2. allocates a unique `PAT######` identifier;
3. inserts the patient document;
4. derives a collision-safe login ID;
5. generates a random temporary password;
6. bcrypt-hashes that password;
7. creates the linked patient user with `must_change_password=true`;
8. returns the patient record plus one-time credential fields.

The temporary password is not part of ordinary patient reads. If user creation fails after the patient
insert, the service performs compensating cleanup so an incomplete account is not left behind in the
database. This is appropriate for the current standalone local MongoDB setup; a distributed deployment
should use a transaction-capable topology or a durable workflow/outbox strategy.

## 8. MongoDB and persistence

MongoDB stores users, patients, appointments, medical records, prescriptions, medicines/orders, and
related operational documents. Indexes enforce uniqueness and improve lookups. Relationships are carried
by stable IDs such as user IDs, patient IDs, doctor IDs, appointment IDs, and prescription/order IDs.

The persistence rule is simple: a write is successful only after the backend/database operation succeeds.
The frontend then refreshes or updates from the response. This avoids treating local browser state as a
record of truth.

## 9. API groups

The API is grouped by business domain:

- authentication and current-user access;
- patients and patient profiles;
- doctors and appointments;
- medical records and clinical notes;
- prescriptions and medicines;
- pharmacy orders and status changes;
- CareAI predictions and schema information;
- dashboards, notifications, reports, files, billing, and audit functions where enabled.

Each group should preserve the same order: authenticate, authorize, validate, execute, persist, return.

## 10. Prescription and pharmacy logic

Doctors create prescriptions using the medicine catalog. Where the workflow requires it, prescription
creation leads to a pharmacy order. Pharmacy users update the order through allowed statuses. Patients
see the authorized result rather than gaining control over the pharmacy process.

The backend is responsible for preventing a client from changing unrelated ownership fields or bypassing
the intended order lifecycle.

## 11. CareAI service

The current service loads two joblib artifacts:

- `AI:ML/patient_priority_rf_model.joblib`
- `AI:ML/patient_wait_time_model.joblib`

Models are loaded for inference and are not retrained per request. The API validates the expected input
features, sends them to the correct model, and formats the prediction for the caller. If a model cannot
be loaded or input validation fails, the backend returns an error rather than a fabricated prediction.

The model outputs support workflow awareness. They do not diagnose a patient, prescribe treatment, or
override a qualified clinician. See `AIML.md` for feature order, datasets, evaluation, and limitations.

## 12. Middleware and operational safeguards

- CORS restricts which configured frontend origins may call the API.
- Security headers reduce common browser-side attack surface.
- Audit middleware records authenticated access to protected resources.
- Login throttling slows repeated failed attempts.
- Central exception handling converts failures into consistent API errors.
- Database indexes protect identifiers and make common lookups practical.

The current login throttle is process-local. Multiple backend replicas need a shared rate-limit store to
enforce the same limit across all instances.

## 13. Error behavior

Typical meanings are:

- `200`/`201`: successful read or creation;
- `204`: successful update with no response body;
- `401`: missing, expired, or invalid authentication;
- `403`: authenticated but not permitted;
- `404`: requested resource does not exist or is intentionally hidden;
- `409`: uniqueness or state conflict;
- `422`: request validation failed;
- `5xx`: unexpected server or dependency failure.

The frontend should render these as useful states, but the backend status code remains the contract for
API clients and tests.

## 14. Running and testing locally

With MongoDB running on the configured local port:

```bash
cd Backend
source .venv/bin/activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

The backend test suite currently passes with 79 tests. Tests cover authentication, authorization,
patient-account creation, data validation, API behavior, and CareAI integration paths.

## 15. Known limitations and future hardening

- Standalone MongoDB does not provide the same transaction guarantees as a replica set; registration uses
  compensating cleanup.
- Process-local throttling should move to Redis or another shared store for horizontal scaling.
- Environment secrets, HTTPS termination, backups, monitoring, and key rotation need production-grade
  operational ownership.
- Inactivity is displayed as a notice; no scheduled account deletion is implemented.
- Some optional dashboard presentation content remains frontend-oriented while core records are persisted.

## 16. Backend maintenance rules

- Keep authorization in backend services/routes even when adding frontend restrictions.
- Add schemas before accepting new input.
- Add or review indexes when introducing a new uniqueness or lookup rule.
- Test both the successful path and unauthorized/invalid paths.
- Never log passwords, temporary passwords, JWT secrets, or full clinical payloads unnecessarily.
- Keep model feature order synchronized with the training script and `AIML.md`.
