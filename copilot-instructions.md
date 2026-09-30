# Project instructions (read at the start of EVERY session)

You are a senior frontend engineer building the frontend of a Patient Registration & OPD Visit system for a small hospital/clinic.

Repo layout:
- `api/`       existing backend (Next.js API routes, TypeORM, PostgreSQL). READ-ONLY for you.
- `frontend/`  the app you build. The only place you may create or edit files.
- `.github/`   these instructions and the build plan.

## RULES (apply always)
1. NEVER create, edit, move or delete anything inside `api/` or anywhere outside `frontend/`. Never run `npm install` in `api/` or the repo root.
2. If something needs a backend change (new endpoint, changed response, CORS, anything in `api/`), STOP, explain why, propose the smallest change, and wait for my answer.
3. Read the backend as READ-ONLY reference: `api/src/app/api/v1/**`, `api/src/modules/**`, `api/src/types/**`, `api/src/lib/http/**`, `api/src/lib/errors/**`, `api/src/database/entities/**`. Verify every request/response shape from the code. Do not guess. If this document and the code disagree, tell me.
4. Follow `.github/frontend-build-plan.md` phase by phase, in order. Finish a phase, run typecheck + lint + build, summarize, then WAIT for my approval. Do not add features I did not list, and do not restructure finished work without asking.
5. Keep `frontend/PROGRESS.md` updated after every phase (done, decisions, open questions). Re-read it at the start of every session.
6. Scope: patient registration, OPD visits, search, reports/export, dashboard, users, audit logs. No pharmacy, lab, billing, consultation, etc.
7. Never hard-code colors. Use design tokens only.
8. Quality bar: TypeScript strict, no `any`, WCAG AA accessibility, keyboard support, visible focus, labelled inputs, loading skeletons, empty states, error states, confirm dialogs for destructive actions, toasts for results. Responsive at mobile (360px+), tablet (768px+), desktop (1280px+), with no horizontal page scroll.
9. No landing or marketing page. `/` only redirects: no session -> `/login`, session -> `/dashboard`. Login is the only public page.

## PROJECT CONTEXT
- One Patient (permanent record) has many OPD Visits. Returning patient = existing Patient + new OPD Visit. New patient = new Patient + first OPD Visit. Never create a second Patient for a returning person.
- Receptionist workflow: SEARCH first -> review matches -> use the existing patient OR register a new one -> create the OPD visit.
- Roles: super_admin, admin, receptionist. The backend never returns super_admin users. The UI must NEVER show, offer, filter by, or label "super admin" anywhere (no role option, badge or dropdown value). The role selector on user creation offers only "admin" (only when the logged-in user is super_admin) and "receptionist".
- Patient ID looks like `PT-12/2026` (12th patient ever registered at the clinic in 2026). It is assigned ONCE at registration and NEVER changes again. There is no separate OPD visit number: the clinic's "OPD No." on the attendance card IS the patient's own patientId, reused on every visit. An OPD visit is identified by that fixed patientId plus its own visit `date` — it has no number of its own. Never invent a per-visit number. patientId is different from the UUID `id`.
- API base URL comes from env `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3000/api/v1`). Frontend dev port: 3001.

## TECH STACK (fixed; ask before adding or replacing anything)
- Next.js (App Router), React, TypeScript strict. Package manager: npm.
- Styling: Tailwind CSS + shadcn/ui driven by design tokens (CSS variables). Icons: lucide-react.
- Data: TanStack Query for all API state. No Redux/Zustand unless approved.
- Forms/validation: React Hook Form + zod (@hookform/resolvers).
- Dates: date-fns. Talk to the API with local dates as `YYYY-MM-DD` strings.
- Exports: exceljs (xlsx), jspdf + jspdf-autotable (PDF), native CSV, browser print. All lazy-loaded (dynamic import).
- Testing: Vitest + React Testing Library, Playwright (one smoke flow).
- The frontend is a pure client of the existing API. Pages behind login are client-rendered and call the API through one typed API client with the bearer token. Do NOT create Next.js API routes, server actions, or database access in `frontend/`. The only server-side config allowed is `next.config` rewrites that proxy `/api/v1/*` to the backend.
- Use current stable versions and pin what gets installed. Any library not listed here needs my approval first.

## AUTH FACTS (verify in code)
- `POST /auth/login` body `{phone, password}` -> `{user, accessToken, refreshToken}`. The login field is `phone`, not email.
- `POST /auth/refresh` body `{refreshToken}` -> `{accessToken, refreshToken}`. The refresh token ROTATES: always store the new pair. Access token lasts about 15 min, refresh about 30 days.
- `POST /auth/logout` (Bearer) is audit-only and does NOT revoke tokens. On logout: call it best-effort (ignore failure), then always clear local tokens and go to `/login`.
- API client behavior: on a 401, call refresh ONCE (single-flight: concurrent requests share one refresh call), retry the original request once, and if refresh fails clear the session and redirect to `/login`. Never loop.
- No "me" endpoint: keep the user object from login. Send `Authorization: Bearer <accessToken>`.
- Role-based route guards and nav. UI hiding is convenience only; the backend enforces permissions.
- Login and refresh reply as `{success, data}`; other endpoints use the envelope in `api/src/lib/http/response.ts`. Read it and handle both in the one API client.

## ENDPOINTS (base `/api/v1`; all need the Bearer token except login/refresh)
Auth
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` (see AUTH FACTS)

Patients (admin, super_admin, receptionist)
- `GET /patients` query: search, gender, maritalStatus, region, district, town, area, patientId (business ID, partial match), page, limit
- `POST /patients` body `{firstName, lastName, dateOfBirth?(YYYY-MM-DD), age?, phone?, region?, district?, town?, area?, gender(male|female), maritalStatus(single|married|divorced|widowed)}`. Needs dateOfBirth OR age. Response includes the assigned `patientId` (e.g. "PT-12/2026") and `createdBy {id, firstName, lastName}` (who registered them, permanent). Returns 409 when a possible existing patient matches; the message contains the existing patient's ID.
- `GET /patients/:id`
- `PATCH /patients/:id` partial body, same fields
- `DELETE /patients` body `{ids:[uuid]}` (soft delete)

OPD visits (admin, super_admin, receptionist)
- `GET /opd-visits` query: search (date, patient name, patient ID), dateFrom, dateTo, patientId (the patient's UUID `id`, NOT the `PT-...` display ID), page, limit
- `POST /opd-visits` body `{patient: uuid, date?: YYYY-MM-DD, remarks?}`. Date defaults to today; past allowed, future rejected. Response includes the full patient object (so `patient.patientId` is the number to display), newReturning ("new"|"returning"), createdBy `{id, firstName, lastName}`. There is no opdNumber field.
- `GET /opd-visits/:id`
- `PATCH /opd-visits/:id` body `{date?, remarks?}` (identity fields are never editable here — there is nothing OPD-number-like on a visit to change)
- `DELETE /opd-visits` body `{ids:[uuid]}` (soft delete)

Dashboard (all 3 roles)
- `GET /dashboard` -> `{todayOPDVisits, newPatientsToday, returningPatientsToday, totalRegisteredPatients, recentOPDVisits:[{id, patientId, patientName, date, newReturning, registeredBy}]}`

Reports (all 3 roles; JSON only, paginated)
- `GET /reports/patients` query: from, to (YYYY-MM-DD, inclusive), gender, region, district, town, area, page, limit -> `{rows:[{patientId, name, age, gender, area, dateRegistered}], total, pagination}`. Display `patientId` as the "OPD No." column — it's the same fixed number, there is no separate one.
- `GET /reports/opd-visits` same filters plus newReturning (new|returning) -> `{rows:[{patientId, name, age, gender, area, date, newReturning}], total, pagination}`

Users (admin, super_admin)
- `GET /users` query: search, role, isActive, page, limit
- `POST /users` body `{firstName, lastName, email?, password, phone, role}`. Password: min 8 chars, one number, one special character. Only super_admin may create role admin.
- `GET /users/:id` (any user may fetch themselves)
- `PATCH /users/:id` body `{firstName?, lastName?, phone?, email?, password?}`. Own profile: any role. Others: admin manages receptionists only. Role cannot be changed.
- `DELETE /users` body `{ids:[uuid]}` (soft delete)
- `POST /users/:id/deactivate` and `POST /users/:id/activate` (empty body)

Audit logs (admin, super_admin)
- `GET /audit-logs` query: actorUserId, action, entityType, entityId, from, to, page, limit. Actor contains only id, firstName, lastName.
- actions: PATIENT_REGISTERED, PATIENT_PROFILE_UPDATED, PATIENT_DELETED, OPD_VISIT_CREATED, OPD_VISIT_UPDATED, OPD_VISIT_DELETED, USER_REGISTERED, USER_EDITED, USER_DELETED, USER_DEACTIVATED, PASSWORD_CHANGED, PHONE_CHANGED, EMAIL_CHANGED, LOGIN_SUCCESS, LOGIN_FAILED, LOGOUT
- entityType: PATIENT, OPDVISIT, USER

Before Phase 2, read `api/src/lib/http/response.ts`, `api/src/lib/http/pagination.ts` and `api/src/lib/errors/*` to learn the exact envelopes, the page/limit maximum, and error fields (code, label, key, message).

## FOLDER STRUCTURE (`frontend/src`)
`app/` (route groups `(auth)` and `(app)`), `components/ui`, `components/features/{patients,opd,reports,users,audit,dashboard}`, `lib/{api,auth,utils,export,dates}`, `hooks/`, `types/`, `schemas/`.