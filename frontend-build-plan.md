# Frontend build plan

Rules, context, tech stack, auth and endpoints are in `.github/copilot-instructions.md`. Follow them. Work one phase at a time. After each phase: run `npm run lint && npm run build` inside `frontend/`, update `frontend/PROGRESS.md`, summarize, and WAIT for approval.

Start with Phase 0 only. Do not write code until I answer the colors question.

## PHASE 0: Discovery and questions (no code)
- Read the backend files listed in the instructions (read-only) and summarize the API contract you found. Flag any mismatch with the instructions.
- Confirm the TECH STACK back to me and flag anything you would change.
- List any backend change you think is needed and wait for my decision. Known items: CORS between :3001 and :3000 (try the rewrite proxy first).
- Ask me for the COLORS: primary, accent/secondary, neutral/surface tone, and light only or light + dark. If I am unsure, propose 3 complete palettes (brand, surface, text, border, success, warning, danger, info; WCAG AA contrast) and let me pick. Do not continue until I answer.

## PHASE 1: Scaffold and design system
From the repo root (the folder that contains `api/`):
    npx create-next-app@latest frontend --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
    cd frontend
    npm i @tanstack/react-query react-hook-form zod @hookform/resolvers date-fns lucide-react clsx tailwind-merge
    npx shadcn@latest init
- Set the dev script to `next dev -p 3001`. Create `.env.local.example` with `NEXT_PUBLIC_API_BASE_URL`.
- Proxy `/api/v1/*` to the backend with a `next.config` rewrite. Only ask me about backend CORS if that fails.
- Design tokens (CSS variables + Tailwind theme) from my colors: brand, accent, surface, border, text, semantic colors, radius, spacing, shadows, type scale. One place to change the theme later.
- Base components: Button, Input, Select, Combobox, DatePicker, Dialog, Sheet/Drawer, Table, Tabs, Badge, Toast, Skeleton, EmptyState, ConfirmDialog, Pagination, PageHeader, FormField.
- App shell: sidebar on desktop, collapsible icon rail on tablet, bottom nav or drawer on mobile. Top bar with user menu (name only, plus role label for admin/receptionist) and logout. Tables become stacked cards on mobile.

## PHASE 2: API layer, auth, guards
- One typed API client (fetch wrapper): base URL, bearer token, envelope unwrapping for both response shapes, typed errors, request abort. TanStack Query setup with sensible keys and stale times.
- Silent refresh exactly as in AUTH FACTS (single-flight, retry once, no loops). Unit test it, including the concurrent-401 case.
- zod schemas mirroring the DTO rules (password rules, date format, enums).
- Login page (phone + password), session persistence, `/` redirect logic, route guards, role-based nav, 403 and 404 pages, global error boundary.
- A single `can(role, action)` helper for UI permissions. Nothing ever renders super_admin as a visible or selectable role.

## PHASE 3: Patients
- Search screen (the receptionist's main action): one debounced search box (name, patient ID, phone, DOB, age, area) plus a filter drawer (gender, marital status, region, district, town, area). Paginated, URL-synced filters.
- Result rows: patient ID, name, age, gender, phone, area. Actions: View, Register OPD visit, Edit.
- Register patient form (sectioned, mobile-friendly, zod). AGE AUTO-CALCULATION: when dateOfBirth is entered, calculate age (correct birthday logic, no off-by-one) and show it read-only; with no DOB, enable a manual age input. Send dateOfBirth only when known. Reject future DOB and ages over 130. The backend stays the authority.
- Duplicate handling: on 409 show a "Possible existing patient" panel with the backend message, an action to open that patient (`GET /patients?patientId=<PT- id from the message>`), and two choices: "Use existing patient and register OPD visit" or "This is a different person" (back to editing). Never claim two people are definitely the same.
- After registering a new patient, show their assigned `patientId` (e.g. "PT-12/2026") prominently — this is the clinic's permanent OPD number for them, printed once here and never changing. Offer "Register first OPD visit now" (patient preselected).
- Patient detail page: demographics, age (from DOB if present), visit history (`GET /opd-visits?patientId=<uuid>`), edit/delete/new visit. Edit reuses the register form and age logic.
- Soft delete with ConfirmDialog, single and bulk.

## PHASE 4: OPD visits
- Register OPD visit flow: pick an existing patient via search (or go register a new one). Date defaults to today (past allowed, future blocked), remarks optional. There is no per-visit number to display: after success, show the patient's own `patientId` (their fixed OPD No.) with a New/Returning badge, and a printable attendance slip (patient name, patientId, visit date, phone) via a print stylesheet.
- OPD visit list: search (patient name, patient ID), date presets (Today, Yesterday, This week, This month, This year, Custom range) resolving to dateFrom/dateTo, pagination. Columns: OPD No. (= patient.patientId), patient name, date, New/Returning, registered by.
- Detail page and edit (date and remarks only; make clear the OPD number cannot change), soft delete with confirm.

## PHASE 5: Receptionist dashboard (simple, not analytics-heavy)
- Four stat cards: Today's OPD Visits, New Patients Today, Returning Patients Today, Total Patients. Recent visits list (OPD No., patient, date, New/Returning, registered by). Quick actions: Register Patient, Register OPD Visit, Search Patient, View Reports. Refetch on window focus, skeletons, per-card error states.

## PHASE 6: Reports, filtering, exporting (high priority)
    npm i exceljs jspdf jspdf-autotable
- Two reports: Patient Registration Report and OPD Visit Report.
- Filters: period presets (Today, Specific date, This week, This month, This year, Custom range) resolved to from/to `YYYY-MM-DD` in the user's local date; gender; region; district; town; area; and New/Returning for the OPD report. Active-filter chips, reset, URL-synced.
- Report header such as "Patient Registration Report | Period: 1-30 September 2026 | Total: 384", using `total` from the API.
- On-screen paginated table. EXPORT must include ALL matching rows, not just the current page: loop pages using the backend's max limit (read it from `api/src/lib/http/pagination.ts`) with a progress indicator and a cancel button.
- Exports: Print (print stylesheet with a clinic-name placeholder, period and filters), PDF, Excel (.xlsx), CSV (UTF-8 with BOM). File names like `patient-registration_2026-09-01_to_2026-09-30`. All export code lazy-loaded.

## PHASE 7: Users and audit logs (admin and super_admin only)
- Users list (search, role, active status; never shows super_admin), create user (role options limited as described; live password-rule hints), edit, activate/deactivate with confirm, soft delete with confirm. Show backend 403 messages clearly.
- Own profile page for every role: edit name, phone, email, change password (`PATCH /users/:id` with own id).
- Audit log viewer: filters (action, entity type, date range, actor), paginated table, readable action labels, expandable metadata. Never display hashes or tokens.

## PHASE 8: Hardening and delivery
    npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test
- Responsive QA at 360, 768, 1024 and 1440 for every screen. Keyboard and screen-reader pass. Consistent empty/error/loading states. No console errors.
- Unit tests: age calculation, date-range presets, export row mapping, silent refresh. Component tests: patient form and duplicate panel. One Playwright smoke flow: login -> search -> register patient -> register OPD visit -> dashboard -> report export, plus "session survives access-token expiry via refresh".
- README in `frontend/`: setup, env, scripts, folder structure, how to change theme colors. Final `npm run lint && npm run build` must pass.