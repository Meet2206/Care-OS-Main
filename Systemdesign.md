# CARE-OS System Design

This document explains how CARE-OS works as a complete product. It is written for both technical
readers and people who simply need to understand how the healthcare workflow moves through the system.

## 1. What CARE-OS is

CARE-OS is a role-based healthcare operations system. It gives different people different views of the
same connected information:

- A receptionist registers patients and coordinates appointments.
- A doctor reviews patients, records clinical information, and creates prescriptions.
- Pharmacy staff process medication orders and update their status.
- A patient sees their own account, appointments, medical information, and authorized order status.
- An administrator manages operational access and system-level functions.

The product has three main parts:

1. **Frontend:** the screens and forms people use in a browser.
2. **Backend:** the rule-enforcing application that validates requests and coordinates workflows.
3. **Database and services:** MongoDB stores records; the CareAI service loads trained models for
   predictions.

The browser never talks directly to MongoDB or reads model files. Every important action goes through
the backend so identity, authorization, validation, and persistence are applied consistently.

## 2. Plain-language glossary

- **Frontend:** what a person sees and clicks.
- **Backend:** the server-side decision maker that receives requests and performs business operations.
- **API:** a defined doorway through which the frontend asks the backend to do something.
- **Database:** the durable store for users, patients, appointments, records, prescriptions, orders,
  and audit information.
- **Authentication:** proving who a person is, usually by signing in.
- **Authorization:** deciding what that signed-in person is allowed to do.
- **Token:** a short-lived signed proof attached to later requests after login.
- **Hash:** a one-way protected representation of a password. The original password is not stored.
- **Model:** a trained mathematical program that produces an estimate from input data.
- **Pipeline:** the ordered journey from raw input to cleaned features to a model result.

## 3. Overall architecture

```text
User in browser
      |
      v
React/Vite frontend
      |  JSON request + Bearer access token
      v
FastAPI backend
      |
      +--> authentication and role checks
      +--> request validation
      +--> domain services and controllers
      +--> MongoDB records and indexes
      +--> medicine catalog
      +--> CareAI model service
      |
      v
JSON response back to the frontend
```

The backend is authoritative. A hidden button in the frontend is not treated as security; the backend
also checks every protected route.

## 4. Main users and boundaries

| Role | Main responsibility | Core boundary |
|---|---|---|
| Admin | Operational administration | Can manage operational data, but clinical access remains intentionally limited |
| Receptionist | Registration and coordination | Can create patients and manage front-desk workflows |
| Doctor | Clinical care | Can work with patients connected to their appointments or clinical relationships |
| Pharmacy | Medication fulfilment | Can process pharmacy orders, not clinical administration |
| Patient | Personal care access | Can read and update only permitted personal information |

The same person may use the system repeatedly, but the role attached to the backend account determines
which business actions are available.

## 5. A normal request lifecycle

When a user clicks “Save,” the following happens:

1. The frontend collects the form values.
2. The API client adds the signed-in access token.
3. FastAPI receives the request.
4. Authentication checks that the token is valid.
5. Authorization checks the role and, where needed, ownership or relationship.
6. A schema validates required fields, data types, and formats.
7. A service applies business rules, such as unique patient IDs.
8. MongoDB writes or reads the record.
9. The backend returns a status code and JSON result.
10. The frontend updates the screen from the response and displays success or an actionable error.

This sequence prevents the interface from claiming success when the database did not accept the change.

## 6. Data model and relationships

The central relationships are:

```text
User account
   |-- may link to --> Patient
   |-- may represent --> Doctor / Receptionist / Pharmacy / Admin

Patient
   |-- has --> Appointments
   |-- has --> Medical records
   |-- has --> Prescriptions
   |-- has --> Pharmacy orders
   |-- receives --> CareAI results in permitted workflows

Doctor
   |-- participates in --> Appointments
   |-- authors --> Medical records and Prescriptions

Prescription
   |-- references --> Medicine catalog entries
   |-- may create --> Pharmacy order
```

Important identifiers are kept as explicit references rather than copied display text wherever
possible. Unique indexes protect patient IDs, email addresses, and user login identifiers. This makes
refreshing, logging out, and returning later safe because the source is the database, not temporary UI
state.

## 7. Patient registration and account creation

The current registration flow is intentionally designed around a receptionist helping a patient in
person:

1. The receptionist opens the multi-step onboarding form.
2. Basic identity, contact, demographic, and emergency-contact information is collected.
3. Optional medical information and doctor assignment are collected where applicable.
4. The frontend validates the form and asks for confirmation.
5. `POST /api/v1/patients` creates a `PAT######` patient ID.
6. The backend creates the patient record and a linked `patient` user account.
7. The backend generates a collision-safe login ID and a random temporary password.
8. Only the creation response contains the temporary password.
9. The frontend shows a credential ticket with the patient name, ID, login ID, and temporary password.
10. The patient signs in and is required to choose a new password.
11. The new password is stored only as a bcrypt hash.

If linked-account creation fails after the patient insert, the service compensates by removing the
incomplete patient record. This avoids leaving a patient without the login account the workflow promises.

The credential ticket is a handoff tool, not a password vault. Closing it clears the displayed
credential state. The inactivity message in the patient portal is an informational warning; it does
not currently delete accounts.

## 8. Clinical and pharmacy workflow

The supported connected workflow is:

```text
Receptionist registers patient
        -> appointment is created
Doctor reviews linked patient
        -> consultation / medical record is recorded
Doctor creates prescription
        -> pharmacy order is created where the workflow requires it
Patient selects full/half fulfillment and pays
        -> backend snapshots quantity and creates pickup token
Pharmacy validates pickup token and collects order
        -> patient sees the authorized status
```

The exact available screens vary by role, but the backend owns the relationship checks and status
transitions. A patient does not receive unrestricted access to another patient’s records, and a
pharmacy account does not become a clinical author merely because it can see an order.

Prescription data and fulfillment data are deliberately separate. The doctor's prescribed quantity is
the clinical instruction and remains unchanged. The patient’s full/half selection is an operational
fulfillment choice stored on the pharmacy order. Payment and pickup state are also order properties,
so a pharmacy transaction cannot rewrite the medical record.

## 9. CareAI placement

CareAI is a decision-support feature, not an autonomous medical decision maker. The current intended
models are:

- patient priority classification, used by permitted operational/clinical users to understand queue
  priority;
- estimated waiting-time regression, used to provide a time estimate for queue management.

The backend receives validated input, loads the corresponding serialized model, produces the result,
and returns a structured response. CareAI does not retrain when a user asks for a prediction. Full
features, metrics, limitations, and the `jenil.md` comparison are in `AIML.md`.

## 10. Security design

- Passwords are protected with bcrypt hashes.
- Login returns a signed JWT access token.
- Protected API routes require that token.
- Backend role checks are authoritative.
- Patients are restricted to their own permitted records.
- Login attempts are throttled in process.
- Security response headers are applied by middleware.
- Authenticated resource access is recorded through audit middleware.
- CORS is restricted by configured frontend origins.
- Temporary passwords are returned only during patient creation and are never included in ordinary
  patient reads.

The local development configuration is not a production deployment policy. Production should use HTTPS,
managed secrets, a durable rate-limit store, a managed MongoDB policy, and a formal backup/restore plan.

## 11. Startup and health

MongoDB is expected at the configured local MongoDB URL, normally `localhost:27017`. The backend starts
on port 8000 and the Vite frontend on port 5173 in the local setup. On backend startup, the application
connects to MongoDB, creates required indexes, and seeds development demo accounts when configured.

Two useful checks are:

- `/health`: process-level health response.
- `/ready`: readiness response that includes database availability.

If MongoDB is unavailable, the backend should be treated as not ready even if the frontend process is
still open.

## 12. Design decisions and why they exist

- **Separated frontend and backend:** the same rules can serve a browser, tests, or a future mobile
  client without duplicating authorization in every screen.
- **MongoDB:** the current application uses document-shaped healthcare records and needs flexible
  nested data while retaining indexes for unique identifiers and lookup paths.
- **Services between routes and database:** business rules stay reusable and testable instead of being
  hidden inside HTTP handlers.
- **JWT access tokens:** the browser can make authenticated API calls without sending the password on
  every request.
- **One-time temporary credentials:** reception can hand an account to a patient without storing or
  displaying a permanent password.
- **Advisory CareAI:** estimates assist workflow decisions but do not replace clinical judgment.

## 13. Current limitations

- The local setup uses standalone MongoDB; multi-record operations do not currently use a distributed
  MongoDB transaction, so compensating cleanup is used in the registration path.
- Login throttling is process-local and should be moved to a shared store for multiple backend replicas.
- There is no automatic inactivity-deletion job; the UI notice is informational.
- Some patient-dashboard support/appointment presentation content is UI-only while core identity,
  appointments, records, and orders are backend-driven.
- CareAI metrics are meaningful for this supplied data, but the datasets are small/synthetic and are not
  evidence of clinical safety or real-world performance.

## 14. Companion documents

- [Frontend design and behavior](frontend.md)
- [Backend architecture and APIs](backend.md)
- [CareAI models, datasets, and evaluation](AIML.md)
- [System logic reference](CARE-OS-SYSTEM-LOGIC.md)
