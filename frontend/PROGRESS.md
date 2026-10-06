# Frontend progress

## Phase 0
- Reviewed the backend contract in the repository and confirmed the app should target the existing API without backend changes unless CORS issues remain after proxy setup.
- Confirmed the fixed tech stack and the repo rule that the UI must never expose the super admin role.
- Selected the clinic palette: professional royal green (`#1B5E5C`, `#6AAE9A`, neutral `#F5F7F4`, light-only theme).
- No code written yet before this phase completed.

## Phase 1
- Scaffolded the Next.js app in `frontend/` using the required stack.
- Installed the app dependencies and initialized the shadcn base setup.
- Configured the dev script to run on port 3001 and added the API rewrite proxy.
- Added the theme tokens and a placeholder home screen using the chosen palette.
- Verified lint/build for this phase.

## Phase 2
- Added the typed API client and session storage layer for auth tokens and the authenticated user.
- Added silent refresh behavior and a single shared refresh path with redirect-on-failure handling.
- Added the auth provider, login page, route guards, and the protected dashboard shell.
- Added the query provider and redirect logic for `/` -> `/login` or `/dashboard` based on session state.
- Validation: lint + production build passed at the end of the phase.

## Phase 3
- Implemented the patient management route shell with a patient search panel and registration form layout.
- Added the patient form, zod validation, and age auto-calculation logic aligned to the backend patient request contract.
- Added patient detail placeholder route and kept the UI consistent with the clinic theme tokens.
- Added the patient registration page state for success/error messaging and the backend patient creation call.
- Validation: lint and production build both pass after the final type fixes.
- Follow-up: added optional Ghana Card and NHIS inputs to registration/edit, exact client-side format validation, and conditional read-only display on patient detail. Search/list fields and columns remain unchanged.
- Follow-up validation: five identifier interaction/schema tests pass; frontend lint and production build pass. The existing 409 feedback remains the generic error banner because the dedicated duplicate-match panel has not been built yet.

## Phase 4
- Added the OPD attendance register page with patient lookup, date, and remarks entry.
- Added patient selection flow and success/error states for the creation API call.
- Added the OPD detail placeholder route and linked the protected shell navigation to both the patient and attendance pages.
- Validation: `npm run build` passes. `npm run lint` passes with one non-blocking warning from the existing React Hook Form `watch()` usage in the patient form component; there are no ESLint errors.

## Phase 5
- Implemented the receptionist dashboard overview with four numeric stat cards and a recent OPD visits list from the dashboard API response.
- Added quick-action buttons for patient registration, OPD registration, patient search, and reports navigation.
- Added a simple reports placeholder route to support the dashboard action flow.
- Validation: `npm run build` passes. `npm run lint` has no ESLint errors; the only remaining result is the same non-blocking React Hook Form warning in the patient form component.

## Phase 6
- Implemented the reports screen with a patient-registration / OPD-visit toggle, date and demographic filters, pagination, and Excel export support.
- Added data-table rendering for the real backend report payloads and kept the clinic-specific labeling of the patient ID as the OPD No.
- Validation: production build passes and the report UI is lint-clean aside from the pre-existing React Hook Form warning from the patient form component.
- Current status: phase 6 is implemented and validated; awaiting approval before moving to Phase 7.

## Phase 7
- Added the staff management screen with search, role and active-status filters, creation flow, password guidance, edit flow, activate/deactivate confirm actions, and delete with soft-delete API wiring.
- Added the profile page for self-service updates and password changes using the user PATCH endpoint.
- Added the audit log viewer with date, action, entity, and actor filters plus paginated table output.
- Kept the UI free of any visible or selectable "super admin" labels and restricts the admin-only navigation to the allowed roles.
- Validation: VS Code diagnostics report no frontend errors after the Phase 7 work.

## Phase 8
- Added the required hardening toolchain: Vitest, Testing Library, and Playwright support.
- Added a small real-behavior test suite covering role labeling and age calculation logic.
- Fixed the profile form state issue and converted the RHF watched values to the safe form-watching pattern to avoid the React lint warning.
- Final verification: test suite passes, lint passes, and the production build passes.

## Phase 9
- Redesigned the protected dashboard shell to use a reusable fixed left sidebar for desktop and a mobile drawer with a fixed hamburger toggle.
- Kept all dashboard routes and permissions intact while preserving the existing branding, user info, and logout behavior.
- Ensured the content area sits to the right of the sidebar and the mobile overlay does not create horizontal overflow on smaller screens.
- Validation: lint and production build were re-run after the navigation change.

## Patient search follow-up
- Extended the existing `GET /patients?search=` matching to include Ghana Card and NHIS numbers, alongside the existing patient fields.
- Updated the patient-search input prompt and accessible name to advertise those searchable identifiers.
- Validation: frontend tests pass (17 tests), the changed search component is lint-clean, and the frontend production build passes. Full frontend lint still reports four pre-existing errors in unrelated files. API lint/build are blocked by pre-existing issues: lint errors in unrelated existing code and a missing `cloudinary` dependency during type-check.

## Patient list filters follow-up
- Implemented the previously inactive Filters button as an accessible responsive filter panel for gender, marital status, region, district, town, area, and partial patient ID.
- Filter submissions use the existing `GET /patients` query parameters; administrative-area matching is case-insensitive and exact per the API query, while `patientId` is partial.
- Search text remains combined with filters, and active-filter count, apply, and clear behavior are supported.
- Validation: focused patient-filter interaction tests pass, changed files are lint-clean, and the frontend production build passes. No backend files were changed.

## OPD visit list filters follow-up
- Confirmed the existing OPD API supports free-text `search` plus inclusive `dateFrom`/`dateTo` filters; search matches visit date, patient name, and the patient's fixed patient ID.
- Added an OPD visit list screen, connected the existing "View visit list" action, and implemented date presets (today, yesterday, this week, this month, this year, custom range), search, and pagination using the supported API contract.
- Kept registration/returning status filters out because the OPD list API does not support them.
- Validation: focused date/query and UI tests pass (3 tests), frontend production build passes, and new/updated list code is lint-clean. Lint on the existing registration page still reports its prior synchronous-state-in-effect issue. No backend files were changed.

## OPD visit detail follow-up
- Replaced the OPD visit ID placeholder with an API-backed visit detail view showing visit date, permanent patient OPD ID, new/returning classification, patient contact/location summary, registrant, and remarks.
- Added links back to the visit list and to the linked patient record, plus print support and explicit loading/error states.
- Validation: focused detail test passes, changed detail files are lint-clean, and production build passes. No backend files were changed.

## Patient detail visual alignment
- Matched the patient detail screen to the OPD detail layout with the same card treatment, section hierarchy, and loading skeleton pattern.
- Grouped patient demographics and contact/location details while preserving existing edit, registration, and identifier behavior; added retry and back actions to the error state.
- Validation: patient detail tests pass (2 tests), changed files are lint-clean, and production build passes. No backend files were changed.

## Patient detail label icons
- Added consistent, decorative Lucide icons to patient detail labels for identity, demographics, identifiers, contact, location, and registration metadata, matching the OPD visit detail style.
- Icons are hidden from assistive technology so the existing label text remains the accessible name.
- Validation: patient detail tests pass, changed files are lint-clean, and production build passes.

## Patient record creation timestamp
- Added the patient's "Record created" date and time to the detail view, formatted consistently with the OPD visit record timestamp and shown with a matching calendar icon.
- Validation: patient detail tests pass (2 tests), changed files are lint-clean, and production build passes.

## Loading skeleton consistency
- Replaced text-only loading placeholders in patient search, OPD patient lookup/selection, the OPD visit list, auth session guards, and dashboard statistic cards with layout-matched skeletons.
- Added a reusable decorative Skeleton UI component and status labels for assistive technology. Existing skeleton loading states on detail, report, audit, and user screens remain in place.
- Validation: focused loading/filter tests pass (5 tests) and production build passes. Lint found only the pre-existing setState-in-effect error in the OPD registration page.

## Password input behavior
- Reverted password visibility controls to the original masked-only password inputs across login, user creation, and profile update.
- Validation: affected files are lint-clean and the frontend production build passes.

## Report export and print field selection
- Added an accessible field-selection dialog before Excel export and printing, with select-all, individual field controls, cancel, and a guard requiring at least one field.
- Excel export includes only selected headers and values while still exporting all rows matching the report filters. Print uses the selected columns in a print-only table while preserving the full on-screen report.
- Validation: report field-selection tests pass (3 tests), changed report files are lint-clean, and production build passes.

## Patient report export fields
- Extended the patient registration report response with all Patient entity fields except `year`, `positionInYear`, and `createdBy`; retained the existing report aliases and filters.
- Expanded the patient Excel/print field picker to offer each included patient field while keeping the normal on-screen report columns unchanged. OPD visit report field selection is unchanged.
- Validation: report and CSV tests pass (5 tests), frontend production build passes, and changed frontend/API report files are lint-clean. API production build remains blocked by the pre-existing missing `cloudinary` dependency/type errors in `src/lib/storage/cloudinaryStorageAdapter.ts`.
- Follow-up: removed fields inherited from the base entity (`id`, `isDeleted`, `createdAt`, `updatedAt`) from the patient report response and export choices; kept the report-specific `dateRegistered` field.
- Follow-up: strengthened the on-screen and printed report table column headings with semibold foreground styling.
- Follow-up: replaced CSV report downloads with Excel workbooks so the selected column headings can be bold; retained selected-field export.
- Follow-up: defined worksheet columns and widths explicitly so exported data starts at A1, and removed pane/filter settings that could leave the workbook viewport offset or obscure content.
- Follow-up: show an em dash for null, undefined, or blank values in Excel exports and printed report cells.
