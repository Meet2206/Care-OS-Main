# CARE-OS

CARE-OS is a role-based healthcare operations application with clinical records, prescriptions, pharmacy processing, patient status visibility, and CareAI decision-support predictions.

## Features

- JWT authentication with doctor, pharmacy, patient, and receptionist roles.
- Patient registration and management.
- Doctor, appointment, and medical-record workflows.
- Medicine catalog search from `Dataset/Medicine_Details.csv`.
- Doctor prescription creation using real clinical relationships.
- Automatic pharmacy-order creation from prescriptions.
- Pharmacy order lifecycle:

```text
PENDING → ACCEPTED → PACKED → DISPENSED
```

- Patient-owned appointment, record, prescription, and pharmacy-order access.
- CareAI priority and wait-time predictions.
- MongoDB persistence and server-side authorization.

## Project structure

```text
CARE-OS/
├── Backend/     FastAPI backend
├── Frontend/    React/Vite frontend
├── AI/ML/       AI model artifacts when present
├── Dataset/     Clinical and medicine datasets
├── README.md
└── CARE-OS-SYSTEM-LOGIC.md
```

For a complete explanation of the application logic, read [CARE-OS-SYSTEM-LOGIC.md](./CARE-OS-SYSTEM-LOGIC.md).

## Requirements

- Python 3.11+ recommended
- Node.js and npm
- MongoDB running locally
- MongoDB database: `care_os`

## Local MongoDB

Start MongoDB using the normal service command for your operating system. CARE-OS expects:

```text
mongodb://localhost:27017/
```

The database name is:

```text
care_os
```

## Backend setup

```bash
cd Backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Copy the safe environment template and configure local development values:

```bash
cp .env.example .env
```

At minimum, configure:

```env
HOST=127.0.0.1
PORT=8000
MONGODB_URI=mongodb://localhost:27017/
DATABASE_NAME=care_os
SECRET_KEY=replace-with-a-local-development-secret
```

Never commit `.env`, production secrets, database credentials, or API keys.

Start the API:

```bash
uvicorn main:app --reload
```

The backend is available at:

```text
http://localhost:8000
```

Health check:

```bash
curl http://localhost:8000/health
```

## Frontend setup

```bash
cd Frontend
npm install
npm run dev
```

The frontend defaults to:

```text
http://localhost:8000/api/v1
```

To use another backend URL, create a frontend environment file with:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## Development accounts

These are development/demo accounts only:

| Login ID | Role |
|---|---|
| `DoctorMeet@CareOS` | doctor |
| `PharmacyMeet@CareOS` | pharmacy |
| `PatientMeet@CareOS` | patient |
| `Reception@CareOS` | receptionist |

Demo passwords are seeded by the backend mechanism and are not stored in the React frontend. Do not reuse development credentials in production.

## Important API flows

### Login

```text
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

### Clinical workflow

```text
POST /api/v1/patients
POST /api/v1/appointments
POST /api/v1/medical-records
POST /api/v1/prescriptions
```

Creating a valid prescription automatically creates one pharmacy order.

### Pharmacy workflow

```text
GET   /api/v1/pharmacy-orders
GET   /api/v1/pharmacy-orders/{order_id}
PATCH /api/v1/pharmacy-orders/{order_id}/status
```

Only pharmacy users can modify pharmacy-order status. Patients can read only their own orders.

### Medicine search

```text
GET /api/v1/medicines/search?q=Augmentin&limit=20
```

### CareAI

```text
POST /api/v1/ai/patient-priority
POST /api/v1/ai/wait-time
```

AI output is advisory decision support, not a diagnosis.

## Testing and validation

Frontend:

```bash
cd Frontend
npm run lint
npm run build
```

Backend syntax:

```bash
cd Backend
python -m compileall -q app
```

Live verification should be performed with MongoDB running. Important tests include authentication, role authorization, patient ownership, prescription creation, pharmacy transitions, AI access, and persistence after backend restart.

## Security rules

- Authentication is handled by the backend.
- Passwords are stored as hashes.
- JWT secrets come from environment configuration.
- Frontend role checks are for navigation only; backend authorization is authoritative.
- Patients cannot access other patients by changing IDs.
- Doctors cannot impersonate another doctor when creating prescriptions.
- Pharmacy users cannot modify clinical records or access CareAI.
- Do not expose model paths, model files, secrets, or database credentials.

## Current boundaries

Some older dashboard presentation sections still contain mock data. The integrated clinical, prescription, pharmacy, and CareAI workflows use backend data. Newly created patients are persisted with real IDs, but linking one to a patient login requires an explicit supported account-linking workflow.

