# CARE-OS Frontend

This document explains the browser application: what it contains, how it talks to the server, how the
role-based screens work, and why the visual design uses its current colors, curves, spacing, and layout.

## 1. Frontend purpose

The frontend is the visible CARE-OS workspace. It turns complex healthcare operations into guided pages,
forms, tables, cards, dashboards, and status messages. It does not own the database or decide whether a
user is truly allowed to perform an action; it asks the backend and renders the authoritative response.

## 2. Technology and source map

- React 18 provides reusable screen components.
- Vite runs the development server and produces the production bundle.
- React Router maps URLs to pages.
- Tailwind CSS utilities and `Frontend/src/index.css` provide styling and responsive behavior.
- `Frontend/src/api/client.js` is the shared HTTP client.
- `Frontend/src/context/AuthContext.jsx` owns signed-in session state.
- `Frontend/src/components/ProtectedRoute.jsx` and role redirects protect navigation.

The main entry points are `Frontend/src/main.jsx` and `Frontend/src/App.jsx`. Module folders group
patient, appointment, medical, prescription, pharmacy, dashboard, and AI screens.

## 3. How a screen gets data

1. A page mounts.
2. It reads the current user and token from `AuthContext`.
3. It calls the shared API client.
4. The client attaches `Authorization: Bearer <token>`.
5. The backend validates the request and returns JSON.
6. The page renders loading, success, empty, or error state.

The client clears an invalid session after a `401`, which returns the user to sign-in rather than leaving
an apparently usable but expired page open.

## 4. Authentication and route behavior

The login page sends credentials to `/auth/login`. The returned token and user details are stored for the
browser session. On refresh, `AuthContext` calls `/auth/me` to restore the session from the token.

The backend returns `must_change_password` for newly created patient accounts. The frontend uses that
flag to show the password-change gate. Because the flag is restored from `/auth/me`, refreshing the page
does not incorrectly remove the gate.

`ProtectedRoute` improves navigation safety, but it is not the security boundary. The backend repeats
role and ownership checks for every protected API request.

## 5. Role-oriented experience

- **Admin:** operational dashboard and permitted management functions.
- **Staff/receptionist:** patient registration, appointment coordination, and front-desk operations.
- **Doctor:** patient context, appointments, clinical records, prescriptions, and permitted CareAI use.
- **Pharmacy:** medicine and pharmacy-order processing.
- **Patient:** personal profile, appointments, authorized medical information, and order visibility.

The same overall visual language is shared across roles so users do not need to relearn the interface,
while navigation and API permissions change according to the signed-in role.

### Prescription and pharmacy screens

The doctor prescription form searches the backend medicine catalogue and submits catalogue IDs rather
than free-text medicine identities. A new medicine row contains frequency chips (`Morning`,
`Afternoon`, and/or `Evening`) and a quantity selector (`5`, `10`, `15`, or `20`). The retired dosage,
duration, instructions, and number-of-doses inputs are not rendered by the current form. Historical
values may still be displayed when the backend returns them, but the new form does not require them.

After the doctor saves a prescription, the patient sees the persisted pharmacy order. The patient can
choose full or half fulfillment, then open the payment flow. A paid digital order displays the secure
pickup QR/token returned by the backend. Pharmacy staff confirm cash when applicable and collect an
order only after the backend validates the token. The UI refreshes from the API after each action, so
payment, fulfillment, and pickup status are not treated as browser-only state.

If a medical record already exists for an appointment but no prescription exists, the appointments
screen opens `Add prescription` and reuses the existing record ID. It does not ask the doctor to create
the consultation again or submit a duplicate medical record. If both record and prescription exist,
the action is shown as `Prescription saved`.

## 6. Patient onboarding interface

The receptionist flow is a guided multi-step form:

1. basic information;
2. medical information;
3. doctor assignment where relevant;
4. review and confirmation.

Draft values are autosaved locally so an accidental navigation does not immediately lose typed form data.
The final save still goes to the backend and is not considered complete until the API succeeds.

After success, `SuccessScreen.jsx` displays a CARE-OS credential ticket containing the patient name,
patient ID, login ID, temporary password, and portal label. The ticket supports copy buttons using the
browser clipboard. Closing the ticket clears the credential state; starting another registration also
clears it. The temporary password is not fetched later from the API.

## 7. Patient portal behavior

The patient dashboard displays backend-authoritative identity, appointments, records, and permitted
orders. A visible “Account Inactivity Notice” explains the current policy warning. It does not claim that
the browser deletes the account, because no automatic deletion job exists in the current system.

The first-sign-in password flow is deliberately blocking until the temporary password is replaced. This
reduces the chance that a shared or printed temporary credential remains the permanent account secret.

## 8. Visual language and rationale

### Color palette

The base surface is a warm cream (`#f6f1e8`) with a soft cream gradient. This keeps large clinical
dashboards visually calm and reduces the harshness of a pure white/black interface. The dark ink color
provides readable text without the glare of pure black.

The primary blue (`#3f78c8`) is used for actions, links, and focused workflow controls because blue is
visually associated with reliability and clear interaction states. Teal (`rgba(35, 148, 123, 0.92)`)
provides the CARE-OS identity color and separates branded panels from ordinary content. Green is used for
successful or healthy outcomes; amber and red are reserved for warnings and errors so urgency is visible
without making the entire screen alarming.

These are interface communication choices, not medical promises. A color does not decide clinical risk;
the backend data and clinician judgment do.

### Curved surfaces

Cards, inputs, modals, and responsive table rows use rounded corners, often around 20–32 pixels. The
curves make dense operational information feel approachable, create a clear visual grouping around each
task, and soften transitions between dashboard areas. They also make the same components comfortable on
touch-sized mobile layouts.

### Typography

`Inter` is used for controls, labels, tables, and body text because its shapes remain legible at small
sizes. `Newsreader` is used as a display face for selected headings, giving the product a human, editorial
tone without sacrificing the readability of operational text.

### Space, cards, and hierarchy

Large gaps and muted panels separate tasks before the user reads every word. A strong heading, short
description, primary action, and supporting card structure help users scan rather than decode a dense
hospital-management screen. Shadows are soft and shallow so elevation distinguishes a modal or card
without looking like a physical obstacle.

## 9. Responsive behavior

The layout is designed for desktop, laptop, tablet, and mobile widths:

- grids collapse at smaller breakpoints;
- tables become stacked labeled cards below the responsive breakpoint;
- wide tables scroll inside their own container rather than forcing the page wider;
- inputs and buttons are constrained to their parent width;
- `overflow-x` is controlled at the page and component level;
- modals and panels use flexible widths and mobile-friendly spacing.

This is important in reception areas, on tablets beside a patient, and on a patient’s phone. Responsive
behavior is a usability requirement, not merely decoration.

## 10. Loading, empty, and error states

Every data-driven module should communicate its state:

- loading state while a request is pending;
- empty state when the database returns no records;
- validation state before submitting malformed input;
- backend error state when the server rejects a request;
- success confirmation after persistence.

The UI should not fabricate a successful record when an API call fails. For fields that are intentionally
presentation-only, the code should keep that distinction clear from backend-authoritative clinical data.

## 11. Frontend security boundaries

- Tokens are sent through the shared client rather than duplicated in every page.
- Role-specific navigation improves usability but does not replace backend authorization.
- The temporary patient password is shown only in the creation ticket and local component state.
- The frontend never connects to MongoDB or loads model files.
- User input is submitted to backend validation; UI validation is an early feedback layer.

## 12. Verification completed

The current frontend has been verified with a production-shaped local workflow: receptionist login,
patient creation, credential ticket display and copy action, patient temporary-password login, password
change, refresh, and persistence of the correct patient identity. `npm run lint` and `npm run build` pass.

## 13. Frontend maintenance rules

- Use `apiRequest()` for backend calls.
- Keep role checks in route configuration readable and mirror the backend policy.
- Treat API responses as the source of truth after a write.
- Add loading, empty, and error states with every new data module.
- Do not put permanent secrets or clinical decisions in browser-only state.
- Test at mobile width when adding a table, modal, or multi-column form.
- Keep display-only demo content visibly separate from persisted clinical data.
