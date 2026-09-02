# CARE-OS — Full-System Audit & Required Changes

> **STATUS: REMEDIATED.** This document was written as an audit on 2026-09-01 and updated on
> 2026-09-02 after the fixes were applied and re-verified. Every finding below carries its outcome.
> The original evidence is preserved so each fix can be traced to the defect it closes.
>
> **Verified after remediation:** 79/79 backend tests pass (was 6/79) · all 10 confirmed attacks now
> blocked · 45/45 role×route combinations correctly guarded · zero clipped content at four viewports ·
> frontend lint and production build clean · full clinical chain green end to end.

---

## REMEDIATION SUMMARY

| Original verdict | Current verdict |
|---|---|
| 🔴 **NOT READY FOR PRODUCTION** | 🟡 **READY WITH MINOR ISSUES** — see *Remaining Work* |

### The ten confirmed attacks, re-tested against a fresh database

| # | Attack | Before | After |
|---|---|---|---|
| 1 | Anonymous `POST /auth/register` with `role: admin` | `201` + full PHI access | **`401`** — admin-gated, `role` off the public surface |
| 2 | Patient deletes a doctor | `204`, unrecoverable | **`403`** — all doctor writes admin-only |
| 3 | Pharmacy reads/updates/deletes appointments | `200`/`200`/`204` | **`403`** on every appointment route |
| 4 | Patient books for another patient | `201` for `PATDEMO002` | **`201` forced to caller's own `patient_id`** |
| 5 | Patient zeroes and settles their own bill | `total 0.0`, `Paid`, then `204` | **`403`** — billing writes are staff-only |
| 6 | Patient password guessable as `{Name}{DOB-day}` | logged in | **`401`** — 14-char random, rotation forced |
| 7 | 25 failed logins, no lockout | 25×`401` | **`429` from attempt 9**, with `Retry-After` |
| 8 | Hardcoded password seeds 5 admin-tier accounts | always, ungated | **refuses to start** outside development |
| 9 | Unlinked doctor reads a patient | `500` `NameError` | **`403`** with a clear message |
| 10 | Every role reaches every route | 45/45 open | **45/45 correctly redirected** |

### AI: the headline defect is closed

Real clinical text and the literal string `"qqqq"` used to produce **byte-identical** predictions,
because `OneHotEncoder(handle_unknown="ignore")` silently discarded both.

```
before:  free text "Acute bronchitis" -> {3:0.0032, 4:0.0272, 5:0.9696}
         garbage   "qqqq"             -> {3:0.0032, 4:0.0272, 5:0.9696}   identical

after:   free text "Acute bronchitis" -> 422  'Diagnosis' must be one of: Acute,
                                              Chronic Controlled, Chronic Uncontrolled,
                                              Critical, Needs Follow-up, Stable
         garbage   "qqqq"             -> 422
```

`GET /ai/schema` now serves the vocabulary read back out of the fitted encoders, the UI renders it as
dropdowns, and `Severity` is bounded to the trained 1–5 range — where it produces five genuinely
distinct predictions instead of saturating:

```
Severity=1 -> class 2   Severity=2 -> class 3   Severity=3 -> class 4
Severity=4 -> class 5   Severity=5 -> class 5     (6-10 now rejected, not silently flattened)
```

### What was built, not just patched

- **Appointments module** (`/appointments`) — booking and consultation capture. The documented chain
  `Patient → Appointment → Medical Record → Prescription` previously had **no UI at all** for its
  middle two steps and could only be completed by calling the API directly.
- **Admin dashboard** rewired to the seven live `/dashboard/*` endpoints that already worked but were
  never called. It now shows real figures (verified: 8 patients, 3 doctors, 9 appointments).
- **Medical records browser** rewired to `/medical-records`, with search, filter, and detail view.
- **Audit trail** — middleware now records every authenticated read and write of health data. The
  `create_audit_log()` function existed and was called by nothing; the collection was permanently
  empty. (Its `IPvAnyAddress` field also could not be BSON-encoded, so it would have failed for any
  caller; fixed.)
- **Medicine type-ahead** against the full 11,825-row catalogue, replacing a fixed slice of the first
  50 rows. The catalogue is now parsed once per process rather than re-read on every request.
- **Forced password rotation** for system-generated patient accounts.
- **46 authorization regression tests** so none of the above can silently return.

### Also fixed

Card PAN/CVV capture deleted outright · patient booking now persists (verified: survives reload) ·
doctor "Save review" no longer silently discards notes · onboarding's doctor-assignment step now
reaches the database · notifications wired to the API (were 3 hardcoded strings) · session-expiry
handling with a 401 interceptor · security headers + CSP + HSTS · `/docs` closed outside development ·
responsive clipping fixed (was losing up to 209px of content) · event-loop blocking in
`get_current_user` · pharmacy CAS race → `409` not `500` · unpaginated `/pharmacy-orders` ·
list endpoints tolerate one bad document · `jspdf` critical advisory · initial JS bundle 741 kB → 350 kB.

---

## I. FINAL HEALTH ASSESSMENT (post-remediation)

### 🟡 READY WITH MINOR ISSUES

Not "production ready" without qualification, and the reason is deployment maturity rather than
application defects. The application logic, authorization model, and clinical workflows are sound and
tested. What is missing is the operational layer around them.

| Area | Before | After |
|---|---|---|
| Clinical workflow engine | ✅ Sound | ✅ Sound, unchanged |
| Database design & indexing | ✅ Sound | ✅ Sound, plus soft-delete and scope indexes |
| Pharmacy state machine | ✅ Sound (one latent race) | ✅ Race closed, paginated, `pharmacy_id` recorded |
| Layered architecture | 🟡 Leaky | ✅ Ownership centralised in `app/utils/security.py` |
| **Authorization** | 🔴 **Multiple privilege escalations** | ✅ **Closed and regression-tested** |
| **Authentication** | 🔴 **Anonymous privesc, guessable passwords** | ✅ **Admin-gated, random, throttled, rotatable** |
| AI/ML integration | 🔴 Inputs inert | ✅ Vocabulary-enforced, domain-bounded |
| Frontend completeness | 🔴 Two portals mock, core flows missing | ✅ Live data; appointments/consultations built |
| Test suite | 🔴 19/25 failing | ✅ 79/79 passing, incl. 46 authz regressions |
| Responsive design | 🟡 Content clipped 768–1280px | ✅ Clean at all four viewports |
| Documentation accuracy | 🔴 Materially overstated | ✅ Rewritten to match the code |
| **Deployment readiness** | 🔴 Absent | 🟡 **Still absent — see below** |

### What still stands between this and production

These are genuine gaps, not nitpicks:

1. **No deployment packaging.** No Dockerfile, no CI pipeline, no TLS termination config, no
   migration tooling. Unchanged from the original audit — it was out of scope for a code remediation.
2. **Login throttling is in-process.** Correct for a single worker; a multi-instance deployment needs
   a shared store. `app/utils/rate_limit.py` is deliberately small so the Redis swap is local.
3. **The AI models remain weak predictors.** They are now *honest* — they refuse inputs they cannot
   use — but `Severity` still carries 0.68 of the priority model's importance, the wait-time model's
   training data is absent from the repo, and the priority model was trained on 500 synthetic rows.
   No metrics, no model card. Treat output as a triage aid, nothing more.
4. **No load testing.** The blocking-driver fix and pagination are inspection-and-unit verified, not
   measured under concurrency.
5. **Some presentational copy is still static** — care-team contacts, assistance options, counter
   alerts, and patient-facing slot availability. Flagged in the code and in the docs; no clinical or
   write path depends on any of it.

## A. ARCHITECTURE VERDICT

### Is the architecture sound? — **Yes, structurally. Do not rewrite it.**

```
React 18 / Vite  ──HTTP+JWT──▶  FastAPI  ──▶ routes ─▶ controllers ─▶ services ─▶ PyMongo ─▶ MongoDB
                                              │
                                              ├─▶ ai_service ─▶ joblib(sklearn Pipeline) [in-process]
                                              └─▶ medicine catalog CSV [Dataset/Medicine_Details.csv]
```

### What is genuinely good

| # | Strength | Evidence |
|---|---|---|
| 1 | **Clean layer separation.** `routes → controllers → services → models`. Controllers translate domain exceptions to HTTP; services own persistence. Consistent across ~14 modules. | Read all of `Backend/app/` |
| 2 | **Excellent database constraint design.** Unique indexes on `login_id`, `patient_id`, `doctor_id`, `appointment_id`, `record_id`, `prescription_id`, plus **compound business-rule uniques**: `unique_active_doctor_appointment_slot`, `unique_medical_record_appointment`, `unique_prescription_medical_record`, `unique_pharmacy_order_prescription`, `unique_bill_appointment`. This is better than most production systems. | Live index dump, all 12 collections |
| 3 | **Conflict rules actually enforced.** Double-booking → `409`. Duplicate record → `409`. Duplicate prescription → `409`. Illegal pharmacy transition → `409`. Doctor impersonation → `403`. | All five verified live |
| 4 | **Pharmacy state machine is race-safe.** `find_one_and_update` with a compare-and-swap on the current status; 6 concurrent `ACCEPTED` writes → 1×`200`, 5×`409`, zero corruption. | Live 6-thread race |
| 5 | **File upload security is done right.** Magic-byte sniffing (`%PDF-`, `\x89PNG`, `\xff\xd8\xff`), extension cross-check against detected type, streaming 10 MB cap, UUID stored filename, `Path(...).name` traversal strip. | `Backend/app/services/file_service.py` |
| 6 | **Auth token handling is correct.** `alg=none` forgery rejected; expired/invalid tokens rejected; identity re-resolved from DB per request; deleted/inactive users rejected even with a valid token. | Live JWT tamper tests |
| 7 | **Patient ownership scoping works where implemented.** Patient list endpoints are server-side forced to `current_user.patient_id`; cross-patient reads → `403`. | Live IDOR probes |
| 8 | **Pydantic validation is thorough** — NoSQL-injection payloads (`{"$ne": null}`) rejected at `422` before reaching Mongo. | Live injection probes |

### What is architecturally wrong

| # | Problem | Why it matters |
|---|---|---|
| A1 | **Authorization is decided per-route by hand, inconsistently.** Six different patterns coexist: `require_roles(...)`, bare `get_current_user`, in-body role checks, ownership helpers, and none-at-all. There is no central policy. | This is the root cause of ~8 of the 10 critical findings. Every new endpoint is a new chance to leak. |
| A2 | **Resource-level ownership is not a first-class concept.** `require_patient_ownership()` exists but there is **no** `require_doctor_ownership()`. So role checks pass and any doctor reaches any patient's records. | Cross-doctor PHI exposure |
| A3 | **`app/middleware/` is an empty package.** No request logging, no rate limiting, no security headers, no correlation IDs. | Nothing to attach cross-cutting policy to |
| A4 | **Business logic sits in the frontend for two flows.** Appointment booking and payment "validation" happen entirely in React and never reach the server. | Fabricated state, unpersisted work |
| A5 | **Presentation and truth are mixed.** `mockData.js` (418 lines) is imported by 9 components including 3 dashboards, sitting beside real API data with no visual distinction. | Users cannot tell real from fake |
| A6 | **AI model is loaded in-process** via `@lru_cache` in the API worker. Fine today (~5 MB), but it couples API scaling to model memory and blocks the worker during inference. | Scaling ceiling |
| A7 | **Two blocking-IO-in-async-def sites.** `get_current_user` is `async def` but calls **synchronous** `db.users.find_one()`. This blocks the event loop on **every authenticated request**. | Throughput cliff under load |
| A8 | **`motor` (async Mongo driver) is a declared dependency but is never imported.** The codebase is 100% synchronous `pymongo`. | Dead dependency, misleading |

### Minimum safe architectural correction (do not rewrite)

1. Introduce `app/middleware/` for real: rate limiting, security headers, request-ID logging, audit-log emission.
2. Add **one** authorization module with a resource-ownership matrix, and route every endpoint through it.
   Replace the six ad-hoc patterns with `Depends(authorize(resource, action))`.
3. Move `POST /auth/register` behind admin auth; strip `role` from the public surface entirely.
4. Make `get_current_user` a `def` (FastAPI will threadpool it) or switch to `motor`.
5. Delete `mockData.js` imports from dashboards; wire the 7 already-working `/dashboard/*` endpoints.

---

## B. PORTAL VERIFICATION

All five accounts authenticate successfully and land on the correct dashboard.
`GET /auth/me` restores sessions after refresh. Logout clears the token.

### Cross-cutting result: 🔴 **every role can reach every route by URL**

Driven in a real browser. Requested path == reached path for **9 routes × 5 roles = 45/45**.
`ProtectedRoute` checks only *"is there a user"*, never *"is this user allowed here"*.

```
patient   → /admin              → renders full Admin Dashboard (mock metrics, no API needed)
patient   → /admin/patients/new → renders the patient-registration wizard
pharmacy  → /admin              → renders full Admin Dashboard
pharmacy  → /patient            → renders Patient Portal shell
```

Because `AdminDashboard` is **100% mock data**, it needs no API call — so it renders complete,
authentic-looking hospital operations data for a *pharmacy* or *patient* user. The mock-data problem
and the access-control problem compound each other.

### Admin — `Admin@CareOS`
| | |
|---|---|
| Login / dashboard | ✅ `/admin` |
| Modules tested | Dashboard, Patients (list/detail/create), Medical Records, Pharmacy, Audit Logs, DB-test, all 7 `/dashboard/*` analytics |
| CRUD | ✅ patients C/R/U/D, ✅ doctors C/R/U/D, ✅ bills |
| Backend analytics | ✅ All 7 endpoints return correct live aggregates (`overview`, `revenue`, `appointments`, `doctors`, `departments`, `patients`, `recent`) |
| **Issues** | 🔴 **Dashboard is 100% mock** — zero API calls; the 7 working endpoints above are never consumed. 🔴 Admin is **denied** `/ai` (403) and `/medicines/search` (403) despite the nav implying access. 🔴 Nav links to `/pharmacy`, but admin gets 403 on the status-change action. 🟡 Audit-log viewer reads a collection nothing ever writes to. |

### Doctor — `DoctorMeet@CareOS`
| | |
|---|---|
| Login / dashboard | ✅ `/doctor` |
| Modules tested | Patient list, appointments, medical records, medicine catalog, prescription creation, CareAI |
| CRUD | ✅ Prescription create (full chain verified). ❌ No UI to create appointments or medical records. |
| Integration | ✅ Prescription → auto pharmacy order → pharmacy queue → patient view. Verified. |
| Authorization | 🔴 Can read/update/delete **any** medical record and **any** prescription, regardless of which doctor owns it. `?doctor_id=` on the list endpoint is a free-text filter, not a scope. |
| **Issues** | 🔴 On a fresh install the account has `doctor_id = null` → sees 0 patients, cannot prescribe. 🔴 Medicine picker loads the **first 50 rows** of an 11,825-row catalog once, with no query — the `?q=` search endpoint is never called. 🔴 "Save review" with no medicines shows *"Review saved"* and **makes no API call** — the review, report request and notes are silently discarded. 🟡 Content clipped at 1280px and 768px. |

### Pharmacy — `PharmacyMeet@CareOS`
| | |
|---|---|
| Login / dashboard | ✅ `/pharmacy` |
| Modules tested | Order queue, status transitions |
| CRUD | ✅ `PENDING → ACCEPTED → PACKED → DISPENSED`; invalid transitions `409`; concurrent writes safe |
| Authorization | 🔴 **Can `GET`, `PUT` and `DELETE` appointments.** Verified: `PUT /appointments/APTDEMO001` → `200`, `DELETE /appointments/APTDEMO005` → `204`. Directly contradicts the documented policy. 🔴 Can create/update/delete doctors. |
| **Issues** | 🔴 Above. 🔴 Nav shows "Medical Records" to pharmacy. 🟡 `/pharmacy-orders` returns **every order, unpaginated**. 🟡 Content clipped at 1280/768px. |

### Patient — `PatientMeet@CareOS` + auto-created `ChandraDave@CareOS`
| | |
|---|---|
| Login / dashboard | ✅ `/patient` |
| Modules tested | Profile, appointments, records, prescriptions, pharmacy orders, booking, CareAI |
| Ownership | ✅ Correctly scoped — cross-patient reads all `403`; order/record/prescription lists correctly filtered |
| Integration | ✅ Doctor's prescription became visible to the patient through the pharmacy order. Verified. |
| **Issues** | 🔴 **Appointment booking is pure theatre** — no API call; the "confirmed" appointment vanishes on refresh. 🔴 **Card PAN + CVV + UPI ID collected** with no processor. 🔴 Can zero and mark their own bill Paid, then delete it. 🔴 Can create appointments for *other* patients. 🔴 CareAI is broken for patients (see §C). 🔴 Can reach `/admin`. 🟡 "Appointment Status", "Visit Assistance", care team, doctor directory, time slots — all mock. 🟡 Content clipped even at 1440px (1159px content in a 1110px box). |

### Receptionist — `Reception@CareOS`
| | |
|---|---|
| Login / dashboard | ✅ `/reception` |
| Modules tested | Patient registration wizard, patient list, appointments |
| CRUD | ✅ Registration works and auto-creates a linked patient login |
| **Issues** | 🔴 **The entire "Doctor Assignment" wizard step is discarded on submit** — `assigned_doctor_id`, appointment type and date are collected in the UI and never sent. 🔴 No UI to create the appointment the wizard implies. 🟡 Backend permits receptionists to use CareAI; the UI never offers it. ✅ Only role with clean layout at all four viewports. |

---

## C. AI/ML VERIFICATION

### Model inventory

| | Priority model | Wait-time model |
|---|---|---|
| File | `AI:ML/patient_priority_rf_model.joblib` | `AI:ML/patient_wait_time_model.joblib` |
| Type | `Pipeline(ColumnTransformer → RandomForestClassifier)` | `Pipeline(ColumnTransformer → RandomForestRegressor)` |
| Hyperparams | 276 trees, depth 8, `min_samples_leaf=9` | 500 trees, depth 50, `min_samples_split=10` |
| Features | 9 | 8 |
| Output | class 1–5 + `predict_proba` | minutes (float) |
| Loading | `joblib.load` under `@lru_cache(maxsize=1)` — loaded once ✅ | same |
| sklearn version | 1.6.1, matches pin — **no `InconsistentVersionWarning`** ✅ | ✅ |

**Integration path — verified working end to end:**
`React → apiRequest → POST /api/v1/ai/* → role+ownership check → pydantic → DataFrame → sklearn Pipeline → predict/predict_proba → JSON → rendered in CareAI card`

**The model is real and really runs. It is not mocked.** Schema field names match `feature_names_in_` exactly.

### 🔴 AI-1 — Free-text categorical inputs are silently discarded

The `ColumnTransformer` uses `OneHotEncoder(handle_unknown='ignore')` over a **controlled vocabulary**
learned from `Dataset/patient_priority_dataset_500.csv`:

| Field | Actual training vocabulary | What the app sends |
|---|---|---|
| `Diagnosis` | 6 labels: `Stable`, `Acute`, `Chronic Uncontrolled`, `Needs Follow-up`, … | Raw free text from the medical record, e.g. `"Acute bronchitis"` |
| `Symptoms` | 15 single labels: `Fever`, `Headache`, `Cough`, … | Raw free text, e.g. `"Cough, fever, chest tightness"` |
| `Abnormal_Result` | 4-level ordinal: `Normal`, `Slightly/Moderately/Severely Abnormal` | Free-text box, user types anything |
| `Disease` | 15 disease labels | Free-text box, user types anything |

Any value outside the vocabulary is one-hot encoded to **all zeros** and contributes nothing.
`CareAI.jsx` sends `Diagnosis: latestRecord.diagnosis` and `Symptoms: latestRecord.symptoms` verbatim —
so in production these features are **always** inert.

**Proof (live, through the API, same patient, only categoricals varied):**

```
Exact training vocabulary  ("Acute" / "Cough" / "Moderately Abnormal")
    → prediction 5, probs {3:0.00045, 4:0.02157, 5:0.97798}

Real clinical free text    ("Acute bronchitis" / "Cough, fever, chest tightness" / "Yes")
    → prediction 5, probs {3:0.00321, 4:0.02720, 5:0.96959}

Literal garbage            ("qqqq" / "qqqq" / "qqqq")
    → prediction 5, probs {3:0.00321, 4:0.02720, 5:0.96959}   ← BYTE-IDENTICAL to real text
```

Real clinical text and the string `"qqqq"` produce **exactly the same prediction**. The model is, in
production, a function of the manually-typed Severity number and little else.

**Feature importances confirm it:** `num__Severity` = **0.684** of total importance for priority;
`num__Severity_Score` = **0.621** for wait time. All numeric features together = 0.788.

### 🔴 AI-2 — Severity domain mismatch: API accepts 0–10, model was trained on 1–5

`app/schemas/ai.py` declares `Severity: int = Field(ge=0, le=10)` and the UI renders `min="0" max="10"`.
The training column has **exactly 5 distinct values (1–5)**.

```
Severity= 0 → class 2   probs [0.199, 0.355, 0.198, 0.177, 0.071]   ← near-uniform, meaningless
Severity= 3 → class 4   probs [0.000, 0.016, 0.124, 0.549, 0.311]
Severity= 5 → class 5   probs [0.000, 0.000, 0.000, 0.021, 0.979]
Severity= 7 → class 5   probs [0.000, 0.000, 0.000, 0.021, 0.979]   ← identical to 5
Severity=10 → class 5   probs [0.000, 0.000, 0.000, 0.021, 0.979]   ← identical to 5
```

Same for wait time: `Severity_Score` 5, 8 and 10 all return **34.39 minutes**.
A clinician entering 6–10 gets a saturated answer; entering 0 gets noise.

### 🔴 AI-3 — Two different vocabularies for one field name

`Abnormal_Result` is a **4-level ordinal** in the priority model but **`Yes`/`No`** in the wait-time model.
The UI uses **one shared free-text box** for both. Whatever is typed is wrong for at least one model.

### 🔴 AI-4 — CareAI is completely non-functional for the patient role

`CareAI.jsx` runs, for patients, `apiRequest("/patients?limit=100")`. That endpoint requires
`admin | receptionist | doctor` → patients get **403**. `clinicalPatients` stays empty →
`selectedClinicalPatient` is `undefined` → the guard in `runPrediction` throws before any AI call.
Confirmed in the browser: the patient CareAI page renders *"Insufficient permissions."*
The backend **would** have allowed the prediction. The frontend blocks it.

### 🔴 AI-5 — "Mitra" the chat assistant is entirely hardcoded

`handleSend()` appends a fixed string. There is no LLM, no NLU, no backend call. `symptomGuidance`
is 4 hardcoded blocks of **medical advice shipped in client-side JavaScript**. The UI presents this
as an AI assistant.

### 🟡 AI-6 — Ownership check has a bypass path
`_check_patient_access` only enforces doctor↔patient linkage `if patient_id` is truthy.
Omit `patient_id` and doctor/receptionist get `200` with no linkage check at all. (Low impact —
no data is disclosed, all inputs are caller-supplied — but the guard is not airtight.)

### 🟡 AI-7 — Reproducibility and governance gaps
- The wait-time model's **training dataset is not in the repo** (its `Abnormal_Result` is Yes/No, so it
  did not come from `patient_priority_dataset_500.csv`). Cannot be retrained or audited.
- Priority model trained on **500 synthetic rows**. No held-out metrics, no model card, no version stamp.
- `AI_MODEL_DIR="AI:ML"` — a **colon in a directory name** is legal on POSIX but breaks on Windows and
  in many `PATH`-style contexts. Rename to `AI_ML/` or `models/`.
- `_model_dir()` resolves via `Path(__file__).parents[3]` — depends on the repo layout; breaks if
  `Backend/` is deployed alone (the standard container pattern).
- AI packages live in a **separate `requirements-ai.txt` that the README never tells you to install** →
  a by-the-book install yields `503` on every AI call.

### AI recommendation
**Keep the models. Fix the contract around them.** Do not swap the model — it is a competent RF pipeline.
1. Replace the four free-text inputs with `<select>` dropdowns bound to the **actual training vocabulary**, served from a backend `/ai/schema` endpoint derived from `pipeline.named_steps['preprocessor']` categories.
2. Constrain `Severity` to `ge=1, le=5` in the schema and the UI.
3. Give each model its own `Abnormal_Result` field with its own vocabulary.
4. Reject (`422`) unknown categorical values instead of silently zeroing them — never let a prediction be quietly meaningless.
5. Fix the patient path: fetch `/patients/{user.patient_id}` for patients, not the staff list endpoint.
6. Either wire "Mitra" to a real model or relabel it honestly as a guided form.
7. Commit the wait-time training set, record metrics, add a model card.

---

## D. INTEGRATION VERIFICATION

| # | Workflow | Result | Evidence |
|---|---|---|---|
| 1 | Receptionist registers patient → patient login auto-created & linked | ✅ PASS | `PAT000001` + `ChandraDave@CareOS` created and linked |
| 2 | Doctor creates appointment for that patient | ✅ PASS | `APT000002`, `201` |
| 3 | Double-booking the same doctor/date/time is refused | ✅ PASS | `409 Doctor already has an appointment at this time.` |
| 4 | Doctor creates medical record on that appointment | ✅ PASS | `MR000001`, `201` |
| 5 | Duplicate medical record on same appointment refused | ✅ PASS | `409` |
| 6 | Medicine catalog search | ✅ PASS | `?q=Augmentin` → `MED000002 Augmentin 625 Duo Tablet` |
| 7 | Doctor creates prescription on the real chain | ✅ PASS | `PR000001`, `201` |
| 8 | Doctor cannot prescribe as another doctor | ✅ PASS | `403` |
| 9 | Duplicate prescription per medical record refused | ✅ PASS | `409` |
| 10 | **Prescription auto-creates exactly one pharmacy order** | ✅ PASS | `PO000001`, status `PENDING`, idempotent by unique index |
| 11 | Pharmacy lifecycle `PENDING→ACCEPTED→PACKED→DISPENSED` | ✅ PASS | three × `200` |
| 12 | Illegal transition `DISPENSED→ACCEPTED` refused | ✅ PASS | `409` |
| 13 | Doctor / patient cannot change order status | ✅ PASS | `403`, `403` |
| 14 | **Patient sees their own order and only their own** | ✅ PASS | `total=1`, zero leakage |
| 15 | Concurrent status writes (6 threads) | ✅ PASS | 1×`200`, 5×`409`, no corruption |
| 16 | Persistence across backend restart | ✅ PASS | data intact after restart |
| 17 | Bill creation validates clinical references | ✅ PASS | fake refs → `404 Appointment not found.` |
| 18 | Admin dashboard analytics reflect live data | ✅ PASS *(API)* / 🔴 FAIL *(UI never calls it)* | 7 endpoints correct; dashboard shows mock |
| 19 | **Patient books an appointment from the UI** | 🔴 **FAIL** | No network request. Local state only. Lost on refresh. |
| 20 | **Doctor creates an appointment from the UI** | 🔴 **FAIL** | No such UI exists anywhere |
| 21 | **Doctor creates a medical record from the UI** | 🔴 **FAIL** | No such UI exists anywhere |
| 22 | Onboarding doctor-assignment reaches the DB | 🔴 **FAIL** | Step collected, never sent |
| 23 | Notifications reach any user | 🔴 **FAIL** | Bell shows 3 hardcoded strings; `/notifications` never called; patients & pharmacy get `403` |
| 24 | Audit trail records PHI access | 🔴 **FAIL** | `create_audit_log()` is called by nothing; collection permanently empty |
| 25 | AI prediction from the patient portal | 🔴 **FAIL** | `403` on prerequisite call |

**Critical structural gap:** workflows 20 and 21 mean the documented chain
`Patient → Appointment → Medical Record → Prescription` **cannot be completed through the user interface
at all**. It only completes via direct API calls or the seed script. Every prescription demo depends on
data planted outside the app.

---

## E. UI / RESPONSIVE VERIFICATION

Tested in headless Chrome at **1440×900 (desktop)**, **1280×800 (laptop)**, **768×1024 (tablet)**,
**390×844 (mobile)** for all five portals.

### 🔴 UI-1 — Content is clipped, not scrollable, between 640px and ~1300px

`document.scrollWidth` never exceeds `clientWidth` — but only because `html`, `body`, the Layout
wrapper **and** `<main>` all carry `overflow-x: hidden`. Inside that, content really is too wide,
so it is **silently cut off with no way to reach it**:

| Portal | Viewport | `main` scrollWidth / clientWidth | Content lost |
|---|---|---|---|
| Patient | 1440 | 1159 / 1110 | **49 px** |
| Patient | 1280 | 1159 / 950 | **209 px** |
| Patient | 768 | 832 / 734 | **98 px** |
| Doctor | 1280 | 1024 / 950 | **74 px** |
| Doctor | 768 | 832 / 734 | **98 px** |
| Pharmacy | 1280 | 1038 / 950 | **88 px** |
| Pharmacy | 768 | 832 / 734 | **98 px** |
| Admin / Reception | all | clean | ✅ none |
| All | 390 (mobile) | clean | ✅ none |

**Root cause** (`Frontend/src/index.css`):
```css
.scroll-table       { overflow-x: auto; }
.scroll-table table { min-width: 760px; }        /* ← rigid */

@media (max-width: 640px) {                       /* ← card fallback only below 640px */
  .responsive-table table { min-width: 0; }
  .responsive-table thead { display: none; }
}
```
Between **641px and ~1300px** the 760px `min-width` still applies, and because intermediate flex/grid
children lack `min-width: 0`, that width propagates up past the `.scroll-table` wrapper and expands the
parent section — where `main`'s `overflow-x: hidden` then clips it.

**Fix:** add `min-w-0` to the flex/grid children between `<main>` and `.scroll-table`, raise the
`.responsive-table` card breakpoint from `640px` to `1024px`, and change `main`'s
`overflow-x: hidden` to `overflow-x: auto` so any residual overflow scrolls instead of vanishing.

### ✅ What works well
- Mobile drawer navigation is correct: hamburger in Topbar, `translate-x-full` off-canvas `aside`, dimmed overlay with `aria-label`, explicit Close button, auto-close on nav.
- Desktop sidebar is `sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto` — **scrolls independently** as intended.
- Role-scoped nav menus exist per role (navigation-only — no security value).
- Consistent design system: `Button`, `Card`, `Modal`, `StatusPill`, `MetricCard`, `PageIntro`.
- Loading, empty, error and success states are present on the API-backed pages.
- `text-wrap-anywhere` prevents long-token overflow in chat bubbles.
- ESLint passes with **zero** warnings. Production build succeeds in 1.5 s.

### 🟡 Other UI issues
| # | Issue | Location |
|---|---|---|
| UI-2 | **`"SHARED LOGIN PAGE"` is a hardcoded eyebrow on every page of every portal** | `Topbar.jsx:60` |
| UI-3 | Page-title map has no entry for `/reception`, `/admin/patients`, `/admin/patients/new`, `/admin/patients/:id` → these all fall back to `"CareOS"` | `Topbar.jsx:5-12` |
| UI-4 | Notification bell: 3 hardcoded strings + a permanent unread dot, identical for every user forever | `Topbar.jsx:37-41` |
| UI-5 | 700 kB main JS chunk (212 kB gzip); `jspdf` + `html2canvas` eagerly bundled; no code splitting | `vite build` output |
| UI-6 | Login form has no submit-disabled state → double-submit possible; no `autocomplete` attributes | `Login.jsx` |
| UI-7 | PDF patient ID card prints the literal text `"QR Code"` instead of a QR code | `SuccessScreen.jsx:59` |
| UI-8 | A **static UPI payment QR image** is committed and shipped in the bundle (`upi-payment-qr.png`, `upi payement.jpeg` — also a typo'd filename) | `Frontend/` |

---

## F. SECURITY / AUTH VERIFICATION

### 🔴 SEC-1 — CRITICAL: Anonymous privilege escalation to admin
`POST /api/v1/auth/register` is **unauthenticated** and accepts a caller-supplied `role`.

```
POST /api/v1/auth/register   {"full_name":"Mallory","login_id":"attacker@evil.test",
                              "password":"Passw0rd!23","role":"admin"}
  → 201 Created, role = admin
POST /api/v1/auth/login       → 200, admin token
GET  /api/v1/patients         → 200   (all patient PHI)
GET  /api/v1/audit-logs       → 200
GET  /api/v1/db-test          → 200   (DB structure)
DELETE /api/v1/patients/{id}  → 204   (record destroyed)
```
Registering as `doctor` also succeeds. **Zero credentials required. Full system compromise.**

**Fix:** `Depends(require_admin)` on `/auth/register`; remove `role` from the public request model;
default to the least-privileged role.

### 🔴 SEC-2 — CRITICAL: Every authenticated role has full CRUD on `/doctors`
`Backend/app/routes/doctor.py` guards all five endpoints with bare `get_current_user` — **no role check**.

```
POST   /doctors  as admin/doctor/pharmacy/patient/receptionist → 201, 201, 201, 201, 201
PUT    /doctors/{id} as every role                             → 200 ×5
DELETE /doctors/{id} as every role                             → 204 ×5
DELETE /doctors/DOCDEMO001 as a PATIENT                        → 204   ← real doctor destroyed
```
The soft-deleted doctor is then **unrecoverable through the API** (`PUT` returns `404`).

### 🔴 SEC-3 — CRITICAL: Hardcoded production-seeded credentials
`Backend/app/services/auth_service.py:130` ships a plaintext password in source and re-seeds
**five privileged accounts on every application startup**, including `admin`:

```python
DEMO_USERS = (
    ("Admin@CareOS",        "<hardcoded>", "admin",        "CareOS Admin"),
    ("DoctorMeet@CareOS",   "<hardcoded>", "doctor",       "Doctor Meet"),
    ("PharmacyMeet@CareOS", "<hardcoded>", "pharmacy",     "Pharmacy Meet"),
    ("PatientMeet@CareOS",  "<hardcoded>", "patient",      "Patient Meet"),
    ("Reception@CareOS",    "<hardcoded>", "receptionist", "Reception"),
)
```
All five verified to log in. `ensure_demo_users()` runs unconditionally in `main.py` `lifespan` —
there is no environment gate. Deploying this to production creates five known-credential admin-tier
accounts. The README's claim that *"demo passwords are seeded by the backend mechanism"* obscures
that the password is a literal string in a tracked file.

**Fix:** gate seeding behind `ENVIRONMENT == "development"`, move the password to an env var, and
purge it from source (and from git history).

### 🔴 SEC-4 — CRITICAL: Patient passwords are deterministic and permanent
`patient_service.py:105` — `temporary_password = f"{NameToken}{DD_of_birth}"`.

```
"Chandra Dave", DOB 1992-03-16  →  ChandraDave@CareOS / ChandraDave16     (verified: 200 OK)
```
Both inputs are visible to any staff member and often to the public. There is **no
change-password endpoint anywhere in the API**, and no forced rotation — the "temporary" password is
permanent. Combined with SEC-5 this is practical mass account takeover.
The plaintext password is also returned in the `POST /patients` HTTP **response body**.

### 🔴 SEC-5 — No rate limiting or account lockout
25 consecutive failed logins against `Admin@CareOS` → **25 × `401`, zero `429`**, in 6.1 seconds.
No delay, no lockout, no CAPTCHA, no IP throttling on any endpoint.

### 🔴 SEC-6 — Pharmacy role can read, modify and delete appointments
```
GET    /appointments/APTDEMO001 as pharmacy → 200
PUT    /appointments/APTDEMO001 as pharmacy → 200   ← clinical record modified
DELETE /appointments/APTDEMO005 as pharmacy → 204   ← clinical record destroyed
```
`appointment.py` excludes pharmacy from the **list** endpoint only. The by-ID handlers accept
pharmacy and call `require_patient_ownership`, which is a **no-op for non-patient roles**.

### 🔴 SEC-7 — Patients can create appointments for other patients
```
POST /appointments {"patient_id":"PATDEMO002", ...} as patient PATDEMO001 → 201 APT000001
```
`create_appointment` performs no ownership check at all.

### 🔴 SEC-8 — Patients can zero out and settle their own bills
```
PUT /bills/{id} {"payment_status":"Paid","consultation_fee":0,"medicine_cost":0,"tax":0}
  as the patient → 200   { payment_status: "Paid", total_amount: 0.0 }
DELETE /bills/{id} as the patient → 204
```
`billing.py` permits **all five roles** on create/update/delete and only checks patient ownership —
which grants, rather than restricts, the patient's access to their own invoice.

### 🔴 SEC-9 — Cross-doctor PHI exposure
- `GET/PUT/DELETE /medical-records/{id}` — role `doctor` only; **no doctor↔record linkage check**. Any doctor can read, alter or delete any patient's clinical record.
- `GET /medical-records?doctor_id=X` — `doctor_id` is a free filter, not a scope. Verified `200`.
- `PUT/DELETE /prescriptions/{id}` — same, any doctor.
- `GET /reports/patient-history/{patient_id}` — role `admin|doctor`, **no linkage check** — full history of any patient.

### 🔴 SEC-10 — Runtime crash used as an access control
`Backend/app/routes/patient.py` raises `HTTPException` on lines **80** and **94** but **never imports it**.

```
GET /patients/PAT000003 as an unlinked doctor → 500 Internal Server Error
NameError: name 'HTTPException' is not defined. Did you mean: 'BaseException'?
    at app/routes/patient.py:94 in update_patient
```
It fails *closed* by accident. Adding the import without reviewing the logic, or wrapping this in a
handler, converts a crash into an open door. Also leaks `500` where `403` is correct.

### 🔴 SEC-11 — No frontend authorization
`ProtectedRoute` checks only for a logged-in user. 45/45 role×route combinations reachable (see §B).

### 🟡 Medium-severity security findings
| # | Finding |
|---|---|
| SEC-12 | JWT stored in `localStorage` — persistent XSS exfiltration target. (`CARE-OS-SYSTEM-LOGIC.md` §4.2 claims "session storage"; the code uses `localStorage`.) Prefer `httpOnly` `SameSite=Strict` cookies. |
| SEC-13 | **No 401 interceptor.** Tokens expire in 30 min; on expiry the user is not redirected to login — pages just show errors. No refresh-token flow. |
| SEC-14 | **No security headers at all**: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Referrer-Policy` — all absent. Clickjacking is possible. |
| SEC-15 | `/docs`, `/redoc`, `/openapi.json` publicly served — full API map for an attacker. |
| SEC-16 | **`/api/v1/files` access control is inverted**: doctors get `403` (cannot see their patients' scans); receptionists can download **any** patient's file with no ownership check. |
| SEC-17 | Patients may `PUT /patients/{own_id}` and edit clinical fields — blood group, allergies, medical history. Verified live (blood group changed to `AB+`). |
| SEC-18 | **No audit trail.** `create_audit_log()` is defined and called by nothing; there is no write route. The collection is permanently empty. HIPAA §164.312(b) requires audit controls. |
| SEC-19 | `CORS_ORIGINS` defaults to `http://localhost:5173` only. The README instructs `npm run dev -- --host 127.0.0.1`, which serves `http://127.0.0.1:5173` — **a different origin**. Following the documented setup produces CORS failures. |
| SEC-20 | Error messages leak Python internals: `"Invalid pharmacy order transition: PharmacyOrderStatus.DISPENSED to PharmacyOrderStatus.ACCEPTED."` — use `.value`. |
| SEC-21 | 🔴 **Card PAN, CVV and expiry collected in the patient booking modal** with no payment processor, no tokenization, no PCI-DSS scope control. `getPaymentValidationMessage` only checks 16 digits / 3 digits. Data is held in React state. **Remove entirely or integrate a real gateway before any deployment.** |
| SEC-22 | `python-jose 3.5.0` and `ecdsa 0.19.2` have known advisories; `ecdsa` has an unfixed timing-attack advisory. Consider migrating to `PyJWT`. |
| SEC-23 | `npm audit`: **5 vulnerabilities (1 critical, 4 moderate)** — `jspdf ≤4.2.0` → vulnerable `dompurify` (mutation-XSS, prototype pollution). Upgrade to `jspdf@4.2.1`. |
| SEC-24 | No `ENVIRONMENT` concept anywhere — dev and prod behave identically. `SECRET_KEY` has no length/entropy validation. |

### ✅ Security controls that work
- `alg=none` JWT forgery → `401` ✅
- Tampered / expired / missing token → `401` ✅
- Invalid credentials → `401` (no user enumeration; identical response for unknown vs wrong password) ✅
- Deleted / inactive users rejected even with a valid token ✅
- NoSQL injection (`{"$ne": null}`) → `422` at the pydantic boundary ✅
- Passwords stored as bcrypt hashes; never returned in `UserResponse`; never logged ✅
- Malformed JSON → `422`; 100 KB payload → `422` ✅
- CORS preflight from an unlisted origin → `400`, no `Access-Control-Allow-Origin` ✅
- File upload: magic-byte validation + traversal-safe naming + size cap ✅
- No `.env` file has ever been committed (verified across full git history) ✅

---

## G. BUGS FOUND (ranked)

### 🔴 BLOCKERS

**BUG-1 — `HTTPException` not imported → 500 instead of 403**
- **Problem:** `GET`/`PUT /patients/{id}` return `500` when a doctor is not linked to the patient.
- **Root cause:** `Backend/app/routes/patient.py:80,94` use `HTTPException`; the import line only brings in `APIRouter, Depends, Query, Response, status`.
- **Fix:** add `HTTPException` to the `fastapi` import.
- **Verification:** live `NameError` traceback captured; a static AST scan of all 86 backend files found this as the only genuine undefined name.

**BUG-2 — Public role-selectable registration** → see SEC-1. Fix: admin-gate the route, drop `role` from the public model.

**BUG-3 — `/doctors` has no role guard** → see SEC-2. Fix: `Depends(require_admin)` on POST/PUT/DELETE.

**BUG-4 — Pharmacy can mutate appointments** → see SEC-6. Fix: exclude `pharmacy` from the `CurrentUser` dependency on the by-ID appointment handlers.

**BUG-5 — Patient can book for other patients** → see SEC-7. Fix: force `request.patient_id = current_user.patient_id` for the patient role.

**BUG-6 — Patient can settle their own bill** → see SEC-8. Fix: restrict bill create/update/delete to `admin|receptionist`; patients get read-only.

**BUG-7 — Patient booking never persists**
- **Problem:** The whole booking + payment flow is client-side. The "confirmed, Advance Paid" appointment is pushed into React state only and disappears on reload.
- **Root cause:** `PatientDashboard.jsx:227` `handleBookingSubmit` contains no `apiRequest` call.
- **Fix:** `POST /appointments` (once SEC-7 is fixed to force the caller's own `patient_id`); replace the fake payment with a real gateway or remove it.

**BUG-8 — Doctor "Save review" silently discards work**
- **Problem:** With no medicines selected, the UI shows *"Review saved for {patient}"* and no request is sent. The review text, report request and improvement notes are never stored.
- **Root cause:** `DoctorDashboard.jsx:174` early-returns after `setSaveMessage` when `medicinesCount === 0`.
- **Fix:** persist the review (`PUT /medical-records/{id}`) or state plainly that nothing was saved.

**BUG-9 — Onboarding discards the Doctor Assignment step**
- **Problem:** `StepDoctorAssignment` collects doctor, appointment type and date. `handleSubmit` sends none of them.
- **Root cause:** `PatientOnboarding.jsx:154-166` — the payload omits `assigned_doctor_id`; the backend field exists (`schemas/patient.py:39`) and is simply never populated.
- **Fix:** include `assigned_doctor_id`, and create the appointment from the same wizard.

**BUG-10 — Card PAN/CVV capture** → see SEC-21.

### 🔴 HIGH

**BUG-11 — Fresh install per the README produces an unusable system**
- **Problem:** `ensure_demo_users()` creates all five accounts with `doctor_id = null` and `patient_id = null`. Verified live on a clean DB. Consequence: the doctor sees **0 patients**, cannot prescribe (`request.doctor_id != None` → `403`); the patient sees **0** of everything.
- **Root cause:** the linking is done by `Backend/scripts/seed_demo_clinical_data.py`, which the README **never mentions**. It also cannot be run the obvious way — `python scripts/seed_demo_clinical_data.py` → `ModuleNotFoundError: No module named 'app'`; it needs `PYTHONPATH=. python -m scripts.seed_demo_clinical_data`.
- **Fix:** document the seed step, add `sys.path` bootstrapping to the script (or a console entry point), and have `ensure_demo_users` link IDs.

**BUG-12 — Test suite: 19 of 25 tests fail**
```
19 failed, 6 passed in 3.65s
  pydantic ValidationError: UserResponse.login_id  Field required   (× ~14)
  AttributeError in auth_service tests             (× ~4)
```
The fixtures predate the `email → login_id` refactor. Also **`pytest`, `pytest-asyncio` and `httpx`
are absent from both requirements files** — `pytest` cannot even collect without
`RuntimeError: ... requires the httpx2 package`. There is effectively **no regression safety net**,
which is why the issues in this report survived. `CARE-OS-SYSTEM-LOGIC.md` §18 nonetheless asserts
the system "has been live-tested" for exactly these behaviours.

**BUG-13 — Admin Dashboard is 100% mock**
Zero `apiRequest` calls in `AdminDashboard.jsx`; renders `adminMetrics` / `adminPanels` from
`mockData.js`. Meanwhile **seven** `/dashboard/*` endpoints are implemented and return correct live
aggregates (verified: `total_patients: 6`, `total_appointments: 7`, department breakdown, etc.).
The data exists; the UI just doesn't ask for it.

**BUG-14 — Medical Records page is 100% mock**
`MedicalRecords.jsx` has no API call and renders `medicalRecords` from `mockData.js`. It is in the
sidebar for **four** roles (admin, doctor, patient, pharmacy) while `/medical-records` works fine.

**BUG-15 — Medicine picker exposes 50 of 11,825 medicines**
`DoctorDashboard.jsx:75` calls `/medicines/search?limit=50` **with no `q`** exactly once. The user
never types into a backend-backed search. Doctors can only prescribe from an arbitrary alphabetical
slice. `Dataset/Medicine_Details.csv` has 11,825 rows and the `?q=` endpoint works correctly.

**BUG-16 — Notifications module is entirely fake**
Bell renders 3 hardcoded strings with a permanent unread dot. `/notifications` is never called from
anywhere in the frontend. The backend denies `patient` and `pharmacy` (`403`) — the two roles that
most need notifications. No notification is ever created by any workflow.

**BUG-17 — Audit logging never happens** → see SEC-18.

**BUG-18 — Cross-doctor PHI access** → see SEC-9.

**BUG-19 — Responsive clipping** → see UI-1.

**BUG-20 — AI input contract broken** → see AI-1, AI-2, AI-3.

**BUG-21 — CareAI unusable for patients** → see AI-4.

### 🟡 MEDIUM

| # | Problem | Root cause | Fix |
|---|---|---|---|
| BUG-22 | Event loop blocked on every authenticated request | `security.py:28` `get_current_user` is `async def` but calls synchronous `db.find_one()` | Make it `def` (FastAPI threadpools it) or adopt `motor` |
| BUG-23 | Latent `500` on concurrent pharmacy status writes | `pharmacy_order_service.py:80` — if the CAS filter loses the race, `find_one_and_update` returns `None` and `model_validate(None)` raises. *(Not reproduced in a 6-thread race; identified by inspection — narrow window.)* | Handle `None` → re-read → `409` |
| BUG-24 | `/pharmacy-orders` returns **every** order, unpaginated, and does not filter `is_deleted` | `list_orders()` | Add pagination + soft-delete filter |
| BUG-25 | One malformed document `500`s an entire list endpoint | `appointment_service.py:195` — a list comprehension over `AppointmentResponse(**doc)` with no per-document tolerance. *(Observed after this audit's own restore script wrote an out-of-enum status — my contamination, not a shipped defect, but it exposes the fragility.)* | Validate per document; skip + log bad rows |
| BUG-26 | Doctor auto-assignment only works with **exactly one** doctor in the system | `patient_service.py:75-78` — `if len(active_doctors) == 1`. With 2+ doctors, verified: new patients get `assigned_doctor_id: None`. | Send `assigned_doctor_id` from the wizard (BUG-9) |
| BUG-27 | `/health` returns `{"status":"healthy"}` without touching the DB | `main.py` static dict | Add a `/ready` that pings Mongo and the model |
| BUG-28 | DB unreachable at startup → 30 s hang, then `ServerSelectionTimeoutError`, process exits. No port ever opens. | `mongodb.connect()` ping in `lifespan` | Lower `serverSelectionTimeoutMS`, log a clean message, expose readiness |
| BUG-29 | Medicine catalog: **full 11,825-row CSV scan on every request**, path resolved via `parents[3]` | `routes/medicine.py:13` | Load into Mongo with a text index, or cache in memory |
| BUG-30 | `temporary_password` returned in the API response body | `patient_service.py:129` | Acceptable only with a forced first-login rotation; add one |
| BUG-31 | `UPLOAD_DIRECTORY = Path("uploads")` is relative to the process CWD | `file_service.py:23` | Make it an absolute configured path |
| BUG-32 | `"SHARED LOGIN PAGE"` on every page; 4 routes have no title | `Topbar.jsx:60,5-12` | Derive from route |
| BUG-33 | `pharmacy_id` is written as `None` and never set — multi-pharmacy unsupported | `pharmacy_order_service.py:41` | Set on `ACCEPTED` |
| BUG-34 | Patient-login uniqueness uses check-then-insert (race); on collision the patient row is **deleted** as compensation | `patient_service.py:100-124` | Use a transaction or retry on `DuplicateKeyError` |
| BUG-35 | `age` computed as a bare year subtraction (ignores month/day) — feeds the AI model | `CareAI.jsx` | Use full date arithmetic |

### 🟢 LOW

| # | Problem |
|---|---|
| BUG-36 | `requirements.txt` is **UTF-16LE with CRLF** (Windows `pip freeze > file`). Modern pip handles the BOM — verified installing cleanly — but it is unreadable in diffs and breaks older tooling. Re-save as UTF-8/LF. |
| BUG-37 | `motor==3.7.1` declared but never imported. Remove. |
| BUG-38 | `Dataset/medicine_dataset.csv` — **85 MB, 248,232 rows, referenced by nothing**. Remove or move to Git LFS. |
| BUG-39 | `app/middleware/` is an empty package. |
| BUG-40 | `Frontend/src/utils/pharmacyOrders.js` is dead code (nothing imports it). |
| BUG-41 | `Backend/app/routes/billing.py` is written in a minified one-line style unlike every other file. |
| BUG-42 | 700 kB main chunk; no code splitting. |
| BUG-43 | `AI_MODEL_DIR="AI:ML"` — colon in a directory name; breaks on Windows. |
| BUG-44 | Model paths resolved via `Path(__file__).parents[3]` — breaks when `Backend/` is deployed alone. |
| BUG-45 | Frontend asset `upi payement.jpeg` — spaces and a typo in a tracked filename. |
| BUG-46 | `browserslist` data is 9 months stale. |

---

## H. DOCUMENTATION ACCURACY

`README.md` and `CARE-OS-SYSTEM-LOGIC.md` are well-written and describe the *intended* system —
but several claims are contradicted by the running code. Anyone trusting them will ship the
vulnerabilities above.

| Claim | Reality |
|---|---|
| *"attaches the access token from browser session storage"* (§4.2) | Uses `localStorage` |
| *"Pharmacy … does not have broad appointment-list access"* (§5) | Pharmacy can `GET`/`PUT`/`DELETE` any appointment by ID |
| *"Pharmacy … cannot modify prescriptions or medical records"* (§5) | True for those two, but it can destroy appointments |
| *"Frontend role checks are for navigation only; backend authorization is authoritative"* | Frontend has **no** role checks, and the backend is not authoritative on `/doctors`, `/bills` or `/appointments` |
| *"Admin behavior is controlled by backend role dependencies"* (§5) | `/doctors` has no role dependency at all |
| *"has been live-tested for … ownership and role attacks"* (§18) | 19/25 tests fail; the role attacks in §F all succeed |
| *"The pharmacy dashboard … does not persist orders to localStorage"* | ✅ Accurate (the util is dead code) |
| *"Demo passwords are seeded by the backend mechanism and are not stored in the React frontend"* | Technically true, but the password is a literal string in a tracked Python file |
| README setup instructions | Omit `requirements-ai.txt` (→ AI returns 503) and the clinical seed script (→ empty doctor/patient portals) |
| README `npm run dev -- --host 127.0.0.1` | Produces a CORS failure against the default `CORS_ORIGINS` |

---

## I. REMAINING ISSUES — NOT VERIFIED

Stated plainly rather than hidden:

1. **BUG-23 (pharmacy CAS race → 500)** — identified by code inspection; a 6-thread race produced the correct `1×200 / 5×409` and did **not** reproduce the `500`. The window is narrow but real.
2. **BUG-25** was surfaced by **this audit's own** cleanup script writing an out-of-enum status, not by a shipped defect. The underlying fragility (no per-document tolerance) is real; the trigger was mine.
3. **Load / performance under concurrency** — not measured. Single-request latency was fine. The `async def` + blocking-driver issue (BUG-22) and the unpaginated endpoints are inspection findings; no load test was run.
4. **Real browser matrix** — Chrome headless only. Safari, Firefox and real iOS/Android devices untested.
5. **Accessibility** — no WCAG/axe audit was performed. Anecdotally, `aria-label`s are present on icon buttons, but colour contrast, focus order and screen-reader flow are unassessed.
6. **File upload end-to-end** — the security logic was read and is sound, but no file was actually uploaded/downloaded (the roles permitted are narrow).
7. **`/reports/revenue`, `/reports/appointments`, `/reports/doctors`** — reachable and role-gated, but their aggregation arithmetic was not verified against hand-computed expected values.
8. **Wait-time model provenance** — its training data is not in the repository, so its quality, class balance and metrics cannot be assessed at all.
9. **Production deployment** — no Dockerfile, CI config, reverse-proxy config, TLS setup or migration tooling exists anywhere in the repo. Deployment readiness is therefore unassessable and should be treated as absent.
10. **Git history** — scanned for committed `.env` files (clean). Not scanned exhaustively for other secrets in historical diffs.

---

## REMEDIATION ROADMAP — STATUS

### Phase 1 — Security blockers ✅ DONE
1. Admin-gate `POST /auth/register`; remove caller-supplied `role`. **(SEC-1)**
2. `require_admin` on `/doctors` POST/PUT/DELETE. **(SEC-2)**
3. Gate `ensure_demo_users()` behind `ENVIRONMENT=development`; move the password to an env var; purge from source and history. **(SEC-3)**
4. Replace deterministic patient passwords with random secrets; add a change-password endpoint and force rotation on first login. **(SEC-4)**
5. Add login rate limiting + lockout. **(SEC-5)**
6. Remove `pharmacy` from appointment by-ID handlers. **(SEC-6)**
7. Force `patient_id` to the caller on `POST /appointments`. **(SEC-7)**
8. Restrict bill mutations to `admin|receptionist`. **(SEC-8)**
9. Add doctor↔patient linkage checks to medical-records, prescriptions and `/reports/patient-history`. **(SEC-9)**
10. Import `HTTPException` in `routes/patient.py`. **(BUG-1)**
11. Add role guards to `ProtectedRoute`. **(SEC-11)**
12. **Delete the card/CVV capture form.** **(SEC-21)**
13. Add security headers; disable `/docs` outside development. **(SEC-14, SEC-15)**
14. `npm audit fix --force` for `jspdf`. **(SEC-23)**

### Phase 2 — Correctness & completeness ✅ DONE
15. Repair the test suite; add `pytest`, `pytest-asyncio`, `httpx` to requirements; add authorization regression tests for every finding above. **(BUG-12)**
16. Wire `AdminDashboard` to the 7 existing `/dashboard/*` endpoints. **(BUG-13)**
17. Wire `MedicalRecords` to `/medical-records`. **(BUG-14)**
18. Build appointment-creation and medical-record-creation UI. **(§D-20, §D-21)**
19. Persist patient booking through the API. **(BUG-7)**
20. Send `assigned_doctor_id` from onboarding. **(BUG-9)**
21. Fix the doctor review silent no-op. **(BUG-8)**
22. Wire the medicine type-ahead to `?q=`. **(BUG-15)**
23. Emit audit logs on every PHI read/write. **(SEC-18)**
24. Wire real notifications; grant patient/pharmacy read access. **(BUG-16)**
25. Add a 401 interceptor and session-expiry handling. **(SEC-13)**

### Phase 3 — AI correctness ✅ DONE
26. Serve the model's real categorical vocabulary from the backend; replace free-text inputs with dropdowns. **(AI-1)**
27. Constrain `Severity`/`Severity_Score` to 1–5. **(AI-2)**
28. Split `Abnormal_Result` per model. **(AI-3)**
29. Reject unknown categoricals with `422` rather than silently zeroing. **(AI-1)**
30. Fix the patient CareAI data path. **(AI-4)**
31. Relabel or genuinely implement "Mitra". **(AI-5)**
32. Commit the wait-time training set; publish metrics and a model card. **(AI-7)**

### Phase 4 — UI, performance, hygiene ✅ DONE (except where noted below)
33. Fix responsive clipping (`min-w-0`, breakpoint 640→1024, `overflow-x: auto`). **(UI-1)**
34. `get_current_user` → `def`; drop `motor`. **(BUG-22, BUG-37)**
35. Paginate `/pharmacy-orders`; per-document validation tolerance. **(BUG-24, BUG-25)**
36. Move the medicine catalog into Mongo with a text index. **(BUG-29)**
37. Remove the 85 MB unused dataset; re-encode `requirements.txt`; delete dead code. **(BUG-36, 38, 40)**
38. Code-split the bundle. **(BUG-42)**
39. Fix Topbar copy and titles. **(BUG-32)**
40. **Rewrite `README.md` and `CARE-OS-SYSTEM-LOGIC.md`** to match reality; add the AI-requirements and seed-script steps. **(§H)**

---

## APPENDIX — Verification environment

```
MongoDB   mongod 127.0.0.1:27018, dbpath in a scratch directory, DB "care_os_audit"
Backend   uvicorn 127.0.0.1:8010, env-var config only (no project .env written)
Frontend  vite    127.0.0.1:5199, VITE_API_BASE_URL -> :8010
Browser   Playwright 1.62.1 driving installed Google Chrome, headless
Python    3.13.13 | fastapi 0.139.2, pymongo 4.17.0, scikit-learn 1.6.1, pandas 3.0.5, numpy 2.5.2
Node      v25.9.0 | npm 11.12.1

Checks executed
  - AST scan for undefined names across all 86 backend Python files
  - 64 API routes enumerated from /openapi.json
  - role x endpoint access matrix (5 roles + anonymous)
  - destructive-authorization probes (create/update/delete as every role)
  - IDOR probes across patients, appointments, records, prescriptions, orders, bills
  - full clinical workflow: patient -> appointment -> record -> prescription -> order -> lifecycle
  - JWT tampering (alg=none, forged claims, expired, absent)
  - 25-attempt brute-force probe
  - NoSQL-injection payloads, malformed JSON, 100 KB payloads
  - CORS preflight from allowed and disallowed origins
  - 6-thread concurrent pharmacy status race
  - direct joblib inference: feature names, importances, domain sweeps, unseen categories
  - AI endpoint sweeps: role access, ownership, vocabulary, severity domain
  - browser: 5 roles x 9 routes reachability + 4 viewports overflow measurement
  - DB-unreachable startup behaviour
  - npm audit, eslint, vite build, pytest

Cleanup
  - All test data confined to "care_os_audit" on port 27018 (throwaway)
  - Frontend/dist removed; git working tree verified clean
  - No application source file was modified
```


---

## POST-REMEDIATION VERIFICATION LOG

Every check below was executed against a **freshly dropped database** after the fixes, using the same
harness that found the original defects.

```
Backend test suite ......................... 79 passed        (was 19 failed / 6 passed)
  incl. tests/test_authorization.py ........ 46 passed        (new; one per authz boundary)
Config guardrails
  production + weak SECRET_KEY ............. refuses to start
  production + SEED_DEMO_USERS=true ........ refuses to start
  CORS_ORIGINS="*" ......................... refuses to start
Non-development hardening
  /docs, /redoc, /openapi.json ............. 404, 404, 404
  Strict-Transport-Security ................ max-age=31536000; includeSubDomains
Response headers (all environments)
  X-Content-Type-Options ................... nosniff
  X-Frame-Options .......................... DENY
  Content-Security-Policy .................. default-src 'none'; frame-ancestors 'none'
  Referrer-Policy .......................... no-referrer
  Permissions-Policy ....................... camera=(), microphone=(), geolocation=(), payment=()
  Cache-Control ............................ no-store
Attack re-tests ............................ 10/10 blocked (table at the top of this document)
Cross-doctor PHI
  doctor 2's exclusive patient ............. hidden from doctor 1's list
  ?doctor_id= filter ....................... ignored; scope forced to the caller
  /reports/patient-history/{other} ......... 403
Clinical chain (fresh DB, end to end) ...... register -> appointment -> record -> prescription
                                             -> auto pharmacy order -> ACCEPTED -> PACKED
                                             -> DISPENSED -> visible to the patient .... all green
  double-booking ........................... 409
  duplicate medical record ................. 409
  duplicate prescription ................... 409
  doctor impersonation ..................... 403
  invalid status transition ................ 409, "Cannot move a pharmacy order from
                                             DISPENSED to ACCEPTED." (no Python enum repr)
  pharmacy_id recorded on accept ........... USR000003
Audit trail ................................ 7 entries written; PHI reads captured with actor,
                                             role, IP, and target; non-PHI reads excluded
Browser (headless Chrome, 5 roles)
  route guards ............................. 45/45 unauthorized routes redirect to own dashboard
  responsive ............................... desktop/laptop/tablet/mobile clean for all 5 roles
  failing API calls during the journey ..... none
  uncaught page errors ..................... none
  patient booking .......................... POST fired, row added, survives reload
  patient portal payment fields ............ none present
  CareAI dropdowns ......................... 7-16 options each, sourced from /ai/schema
                                             0 free-text AI inputs remaining
  admin dashboard .......................... live figures (8 patients, 3 doctors, 9 appointments)
Frontend
  eslint ................................... clean
  production build ......................... success
  initial JS ............................... 350 kB (186 app + 164 vendor), was 741 kB
                                             jspdf + html2canvas now load on demand
  npm audit (prod) ......................... critical jspdf/dompurify advisory resolved
                                             2 moderate react-router advisories remain (no
                                             non-breaking fix published)
```

### Files added

```
Backend/app/middleware/audit.py                     PHI access trail
Backend/app/middleware/security_headers.py          response hardening
Backend/app/utils/rate_limit.py                     login throttling
Backend/app/utils/serialization.py                  per-document list tolerance
Backend/requirements-dev.txt                        test dependencies (were absent entirely)
Backend/tests/test_authorization.py                 46 authorization regression tests
Frontend/src/pages/appointments/Appointments.jsx    the missing scheduling/consultation module
Frontend/src/components/ChangePasswordGate.jsx      forced first-sign-in rotation
Frontend/src/components/common/AsyncState.jsx       shared loading/error/empty states
Frontend/src/components/common/Field.jsx            shared form primitives
Frontend/src/components/modules/clinical/MedicineSearchSelect.jsx   catalogue type-ahead
```
