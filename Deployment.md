# CARE-OS Deployment Guide

This document explains how to deploy the current CARE-OS application as a real hosted system:

```text
Users
  |
  v
Vercel ---------------------> Render Web Service -----------------> MongoDB Atlas
React frontend                 FastAPI API + CareAI inference       Production database
```

The recommended first production deployment keeps the AI inference inside the Render backend. This
matches the current repository: the backend already loads the two serialized scikit-learn pipelines,
caches them in memory, validates their input vocabulary, and exposes the `/api/v1/ai` endpoints. A
separate AI server would add network failure modes, authentication work, cost, and operational
complexity without providing a benefit at the current traffic level.

## 1. Services to create

Create these services in this order:

1. MongoDB Atlas cluster and database.
2. Render Web Service for the FastAPI backend and CareAI models.
3. Vercel project for the React/Vite frontend.
4. Optional custom domains and HTTPS configuration.

Do not use the local MongoDB server in production. `mongodb://localhost:27017/` works only on the
developer's computer. The deployed backend must use a MongoDB Atlas connection string.

## 2. Before deployment

### 2.1 Repository requirements

The repository must contain:

- `Frontend/` — React/Vite application.
- `Backend/` — FastAPI application.
- `AI:ML/patient_priority_rf_model.joblib` — priority classification pipeline.
- `AI:ML/patient_wait_time_model.joblib` — wait-time regression pipeline.
- `Dataset/Medicine_Details.csv` — medicine catalogue used by the backend.

The two model files are approximately 5 MB and 8 MB and are currently committed to Git. Keep them in
the repository for the simple deployment described here. If model files grow substantially, move them
to object storage or a model registry and update `AI_MODEL_DIR`/the model loader before deploying.

### 2.2 Local verification

From the repository root:

```bash
cd Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m compileall -q app main.py
cd ../Frontend
npm ci
npm run lint
npm run build
```

The backend test suite requires MongoDB. Run it only after MongoDB is available:

```bash
cd Backend
PYTHONPATH=. .venv/bin/pytest -q
```

## 3. MongoDB Atlas setup

1. Sign in to MongoDB Atlas and create a project for CARE-OS.
2. Create a production cluster in the region closest to the Render service.
3. Create a database user with a long, unique password.
4. Add the Render outbound IP range to the Atlas Network Access list. For an initial deployment,
   Atlas may use `0.0.0.0/0`, but this is less restrictive; use a fixed Render egress/IP strategy if
   the chosen Render plan supports it.
5. Copy the Atlas SRV connection string.
6. Use a database name such as `care_os_production`.

The resulting value will look like:

```text
mongodb+srv://<user>:<password>@<cluster>.mongodb.net/care_os_production?retryWrites=true&w=majority
```

Do not commit this URI. Store it only as a Render secret environment variable.

## 4. Deploy the backend to Render

### 4.1 Create the service

In Render:

1. Select **New → Web Service**.
2. Connect `https://github.com/Meet2206/Care-OS-Main.git`.
3. Select the `main` branch.
4. Use the repository root as the Render root directory. Keeping the root makes the committed `AI:ML`
   directory and `Dataset/` directory available to the backend.
5. Select a Python runtime.
6. Use these commands:

Build command:

```bash
pip install -r Backend/requirements.txt
```

Start command:

```bash
cd Backend && uvicorn main:app --host 0.0.0.0 --port $PORT
```

Render supplies `$PORT`; do not hard-code port `8000` in the hosted start command.

### 4.2 Render environment variables

Add these variables in Render’s **Environment** settings:

| Variable | Production value |
|---|---|
| `ENVIRONMENT` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | Leave managed by Render, or use the service port value if Render requires it |
| `MONGODB_URI` | MongoDB Atlas SRV URI |
| `DATABASE_NAME` | `care_os_production` |
| `SECRET_KEY` | A unique random value of at least 32 characters |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` or the approved session duration |
| `CORS_ORIGINS` | The exact Vercel production URL, initially entered after Vercel deployment |
| `AI_MODEL_DIR` | `AI:ML` |
| `UPLOAD_DIR` | `uploads` |
| `SEED_DEMO_USERS` | `false` |
| `DEMO_USER_PASSWORD` | Do not set in production |
| `ENABLE_API_DOCS` | `false` |

Generate a secret locally with:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

The backend intentionally refuses to start outside development when the secret is weak or demo-user
seeding is enabled. Never use the development values from `Backend/.env.example` in Render.

### 4.3 CORS configuration

After the Vercel deployment exists, set `CORS_ORIGINS` to the exact frontend origin, for example:

```text
https://care-os-main.vercel.app
```

For a custom frontend domain:

```text
https://care-os.example.com
```

Multiple exact origins are comma-separated:

```text
https://care-os.example.com,https://care-os-main-git-main-meet2206.vercel.app
```

Do not use `*`. CARE-OS uses authenticated requests, and the backend rejects wildcard CORS origins.

### 4.4 Render health checks

Configure the Render health-check path as:

```text
/health
```

`/health` confirms that the process is alive. Use `/ready` for operational monitoring because it also
checks MongoDB and returns HTTP `503` when the database is unavailable.

Expected responses:

```json
GET /health
{"status":"healthy"}
```

```json
GET /ready
{"status":"ready","database":"up"}
```

Interactive `/docs`, `/redoc`, and `/openapi.json` are disabled in production unless explicitly
enabled. Do not enable them publicly unless the deployment has an approved API documentation policy.

## 5. Deploy the frontend to Vercel

### 5.1 Create the project

In Vercel:

1. Select **Add New → Project**.
2. Import the same GitHub repository.
3. Select the `main` branch.
4. Set **Root Directory** to `Frontend`.
5. Confirm the framework is Vite, or configure it manually.
6. Use these settings:

Build command:

```bash
npm run build
```

Output directory:

```text
dist
```

Install command:

```bash
npm ci
```

The Vercel project should deploy only the frontend. It must not contain backend secrets or MongoDB
credentials.

### 5.2 Vercel environment variable

Add this variable for Production, Preview, and Development as appropriate:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://<render-service>.onrender.com/api/v1` |

For example:

```text
VITE_API_BASE_URL=https://care-os-api.onrender.com/api/v1
```

Vite embeds `VITE_*` values into the browser bundle. Therefore this variable is not secret. Never put
`MONGODB_URI`, `SECRET_KEY`, model credentials, or any private token in a `VITE_*` variable.

After changing a Vercel environment variable, redeploy. A browser refresh alone does not rebuild the
Vite bundle.

## 6. Recommended AI/ML deployment choice

### Recommendation: deploy CareAI with the Render backend

This is the recommended first production architecture:

```text
Frontend on Vercel
        |
        v
FastAPI + CareAI joblib pipelines on Render
        |
        v
MongoDB Atlas
```

Reasons:

- The current backend already owns model loading and inference.
- Models are small enough to ship with the backend.
- `@lru_cache(maxsize=1)` prevents loading the models on every request.
- Input validation and model vocabulary enforcement remain in one trusted service.
- No model files or Python dependencies need to be exposed to the browser.
- There is no extra internal API, service credential, or network latency.
- Render can restart the service and reload the models automatically.

The current models are:

| Model | File | Output | Hosting requirement |
|---|---|---|---|
| Patient priority classifier | `AI:ML/patient_priority_rf_model.joblib` | Priority class and probabilities | Loaded by FastAPI on Render |
| Wait-time regressor | `AI:ML/patient_wait_time_model.joblib` | Estimated minutes | Loaded by FastAPI on Render |

Do not retrain a model during a user prediction request. Training remains an offline/release task using
`Backend/scripts/train_careai_models.py`. A model replacement should be evaluated, committed or stored
in the approved artifact store, deployed, and smoke-tested before it is used for live requests.

### When to separate AI into its own service

Consider a separate Render private service, Modal service, or managed model endpoint only when one of
these becomes true:

- model files become too large for the application deployment;
- inference requires GPU or a different runtime;
- model releases need independent scaling and rollback;
- prediction traffic is much higher than ordinary API traffic;
- multiple applications must share the inference service.

If that happens, keep the public API as the authorization boundary. The browser should still call the
FastAPI API, and FastAPI should authenticate the user, validate ownership and inputs, then call the
private AI service. Never expose an unauthenticated model endpoint directly to the browser.

## 7. First deployment sequence

Use this sequence to avoid circular configuration:

1. Create MongoDB Atlas and verify the database user can connect.
2. Create Render with temporary `CORS_ORIGINS=http://localhost:5173` only if a local test is needed.
3. Add all production Render variables, especially `ENVIRONMENT=production`, a strong `SECRET_KEY`,
   Atlas `MONGODB_URI`, and `SEED_DEMO_USERS=false`.
4. Deploy Render.
5. Open `https://<render-service>.onrender.com/health`.
6. Open `/ready` and confirm MongoDB is `up`.
7. Create the Vercel project with `VITE_API_BASE_URL` pointing to Render.
8. Deploy Vercel.
9. Copy the final Vercel production URL into Render’s `CORS_ORIGINS`.
10. Redeploy Render after changing CORS.
11. Redeploy Vercel after any frontend environment-variable change.
12. Run the smoke tests in the next section.

## 8. Production smoke test

Run these checks against the deployed URLs, using test accounts and test patient data approved for the
environment:

### Infrastructure

- `GET /health` returns `200`.
- `GET /ready` returns `200` and reports MongoDB `up`.
- Vercel loads without a blank page or JavaScript bundle error.
- Browser requests go to the Render API URL, not `localhost`.
- Browser console has no CORS errors.

### Authentication and authorization

- A valid user can sign in.
- An invalid password is rejected.
- Logout clears the session.
- Refresh restores only the authenticated session.
- A patient cannot access another patient’s records or orders.
- Pharmacy users cannot edit clinical records or call CareAI.
- Admin-only operations remain protected by the backend.

### Clinical workflow

1. Receptionist registers a test patient.
2. The patient account and one-time credential ticket are created.
3. An appointment is created and persisted.
4. The doctor records the consultation.
5. The doctor creates a prescription using a catalogue medicine, frequency, and quantity.
6. A pharmacy order appears after refresh and after a new login.
7. If the medical record already exists, opening the prescription action does not create a second
   medical record.

### Pharmacy/payment workflow

1. The patient selects `FULL` or `HALF` fulfillment.
2. The order moves to `PENDING_PAYMENT`.
3. A digital payment moves it to `READY_FOR_PICKUP` and returns a pickup QR/token.
4. A cash/on-counter payment remains pending until pharmacy confirmation.
5. Pharmacy collection with the correct token succeeds.
6. Reusing the same token fails.
7. An incorrect token, unpaid order, or unrelated order cannot be collected.
8. The prescription quantity remains unchanged after fulfillment selection.

### CareAI

- The CareAI screen loads its accepted schema from `/api/v1/ai/schema`.
- A valid priority request returns a prediction and probabilities.
- A valid wait-time request returns estimated minutes.
- Invalid categorical values are rejected.
- A missing model returns a controlled server error, never a fabricated prediction.
- Model files are loaded once and are not retrained per request.

## 9. Security checklist

- Use MongoDB Atlas with a dedicated least-privilege application user.
- Use a unique production `SECRET_KEY`; rotate it through a planned session invalidation procedure.
- Set `SEED_DEMO_USERS=false` in every non-development environment.
- Do not commit `.env`, Atlas credentials, Render tokens, or Vercel tokens.
- Keep `ENABLE_API_DOCS=false` unless temporarily required and protected.
- Set CORS to exact trusted frontend origins.
- Use HTTPS URLs only in production.
- Never put backend secrets in Vercel `VITE_*` variables.
- Do not store full card numbers or CVV. The current payment flow sends only the permitted last-four
  value for card references.
- Configure MongoDB backups and test restoration before storing real clinical data.
- Restrict Render logs and database access to authorized operators because logs may contain identifiers.
- Use synthetic test data until privacy, retention, access logging, and incident-response requirements
  have been approved for real healthcare data.

## 10. Deploying model updates

1. Update or retrain the model offline with the approved dataset and training script.
2. Evaluate on held-out data using the appropriate classification or regression metrics.
3. Confirm that feature names, preprocessing, categorical vocabulary, and target mapping match the
   backend inference code.
4. Replace the correct `.joblib` artifact only after evaluation is recorded.
5. Run a direct prediction test and compare it with the `/api/v1/ai` response.
6. Commit the artifact and related code/documentation, or publish it to the approved artifact store.
7. Deploy Render.
8. Confirm `/api/v1/ai/schema` and both prediction paths after deployment.
9. Keep the previous artifact available for rollback.

The target accuracy must never be achieved by evaluating on training data or by changing labels after
the fact. A model may be replaced only when its evaluation is honest, reproducible, and appropriate to
its problem type.

## 11. Rollback

### Frontend rollback

Use Vercel’s deployment history to promote the previous successful deployment. If the API contract has
changed, roll back the backend to a compatible version as well.

### Backend rollback

Use Render’s deploy history or redeploy the previous known-good Git commit. Confirm that its database
schema expectations and environment variables are still compatible.

### Database rollback

Do not roll back MongoDB by deleting collections or manually editing clinical records. Use Atlas backup
and restore procedures with an incident record and an explicit recovery point. Test restores in a
separate database before affecting production.

## 12. Common deployment problems

| Symptom | Likely cause | Fix |
|---|---|---|
| Frontend calls `localhost:8000` | `VITE_API_BASE_URL` missing at Vercel build time | Add the variable and redeploy Vercel |
| Browser reports CORS failure | Vercel origin missing from `CORS_ORIGINS` | Add the exact HTTPS origin and redeploy Render |
| Render exits during startup | Missing Atlas URI, weak secret, or demo seeding enabled | Review Render environment variables |
| `/health` works but `/ready` is `503` | MongoDB unreachable or Atlas network access denied | Fix Atlas allowlist, URI, or credentials |
| AI returns model-loading error | Model files absent or wrong `AI_MODEL_DIR` | Confirm both `.joblib` files are in `AI:ML/` and redeploy |
| API returns `404` from Vercel | Frontend variable lacks `/api/v1` | Set `VITE_API_BASE_URL=https://.../api/v1` |
| Login works locally but not in production | Production database has no approved user or frontend points to the wrong API | Verify database, API URL, and account provisioning |
| Old frontend behavior remains | Vite environment values are build-time values | Redeploy Vercel and hard-refresh the browser |

## 13. Final production definition of done

CARE-OS is ready for a controlled production release only when:

- Vercel serves the frontend over HTTPS.
- Render serves the backend over HTTPS and passes `/health` and `/ready`.
- MongoDB Atlas backups, access controls, and restore procedures are configured.
- Production secrets are stored only in platform secret managers.
- Demo accounts and API documentation are disabled in production.
- CORS allows only approved frontend origins.
- Authentication and role authorization have been tested against the deployed API.
- Patient, appointment, consultation, prescription, pharmacy, payment, and pickup data persist after
  refresh and re-login.
- Both CareAI models load from the deployed artifact path and produce validated responses.
- Model evaluation results and limitations are recorded in [AIML.md](AIML.md).
- A rollback path exists for Vercel, Render, model artifacts, and MongoDB backups.

