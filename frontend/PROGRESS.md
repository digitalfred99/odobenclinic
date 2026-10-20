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
- Checklist correction: replaced the old quick-actions panel with two prominent patient/OPD registration actions and a seven-day new-versus-returning visit chart. New-patient count now intersects patients registered today with their first recorded visit today, so patient-only clinic archive entries do not immediately inflate the operational new-patient count. Returning count remains a count of returning OPD attendances from the existing dashboard API.
- Dashboard actions now open the responsive patient-registration sheet directly or open OPD visit registration. Recent-visit dates and patient IDs use the clinic-facing date/number format.
- Mobile navigation now stays fixed while scrolling and shows ODOBEN CLINIC branding beside the hamburger. No API/backend files were changed.
- Follow-up validation: 12 focused dashboard/patient/OPD/report tests pass, changed files pass targeted ESLint, `npx tsc --noEmit` passes, and `npm run build` passes. Full `npm run lint` still reports three unrelated pre-existing errors in auth initialization and patient identifier input refs.
- Known data limitation: if a historical clinic-record patient is later given a first OPD visit without importing any prior visit history, the existing API classifies that first recorded visit as “new.” Correcting that clinical classification requires backend support for historical visit data or an archive/source marker; the frontend does not invent local-only records to mask it.

## Phase 6
- Implemented the reports screen with a patient-registration / OPD-visit toggle, date and demographic filters, pagination, and Excel export support.
- Added data-table rendering for the real backend report payloads and kept the clinic-specific labeling of the patient ID as the OPD No.
- The report follow-up adds local-date period presets, URL-synced filters, removable active-filter chips, readable date values, report totals and gender/visit-type breakdowns, and selectable-field exports in CSV, PDF, and Excel. Full-result exports show page progress and can be cancelled; OPD remarks continue to come from the existing visit-list API.
- PDF dependencies are pinned to `jspdf@4.2.1` and `jspdf-autotable@5.0.8`; export libraries are loaded only when their export action is selected.
- Validation: 10 focused report/date tests pass, `npx tsc --noEmit` passes, changed report files pass targeted ESLint, and `git diff --check -- frontend` passes. Full `npm run lint` remains blocked by three pre-existing errors in auth initialization and patient identifier input refs. Production builds were attempted with both the default compiler and Webpack but their build workers were terminated with SIGTERM in this shared environment; a successful build for this report follow-up is still outstanding. No backend files were changed.
- Follow-up validation was attempted again during hardening with a build output directory isolated from the active development server, but the production build worker was still terminated with SIGTERM. Report tests, targeted lint, and TypeScript checks had passed for the report implementation; see Phase 8 for current validation status.

## Phase 7
- Added the staff management screen with search, role and active-status filters, creation flow, password guidance, edit flow, activate/deactivate confirm actions, and delete with soft-delete API wiring.
- Added the profile page for self-service updates and password changes using the user PATCH endpoint.
- Added the audit log viewer with date, action, entity, and actor filters plus paginated table output.
- Kept the UI free of any visible or selectable "super admin" labels and restricts the admin-only navigation to the allowed roles.
- Follow-up: marked required staff fields in the create form, added an accessible show/hide password control and live password rule guidance, and made the non-editable role clear during user edits.
- Confirmed the existing login API returns a distinct inactive-account error; the login screen now provides a neutral deactivation message and conditionally shows configured phone/email support links. `src/lib/support-contact.ts` reads optional `NEXT_PUBLIC_SUPPORT_PHONE` and `NEXT_PUBLIC_SUPPORT_EMAIL`; when unset, the contact links are omitted. No backend files or contact details were invented.
- Validation: four focused users/login tests pass, changed files pass targeted ESLint and `npx tsc --noEmit`, and `git diff --check -- frontend` passes. Full lint remains blocked by the existing three unrelated auth-provider and patient-identifier errors. A full build and a focused route build both had their build workers terminated with SIGTERM in this shared environment; successful build verification remains outstanding.

## Phase 8
- Added the required hardening toolchain: Vitest, Testing Library, and Playwright support.
- Added a small real-behavior test suite covering role labeling and age calculation logic.
- Fixed the profile form state issue and converted the RHF watched values to the safe form-watching pattern to avoid the React lint warning.
- Final verification: test suite passes, lint passes, and the production build passes.
- Hardening follow-up: documented the optional support-contact environment variables and isolated build-output option in the frontend README; fixed the existing auth-hydration and patient-identifier ref lint findings without changing runtime behavior.
- Validation follow-up: full lint passed with only an unused-disable warning; after removing that warning, targeted ESLint on all changed hardening files passed. Phase 6 report/date tests (10) and Phase 7 user/login tests (4) pass. Full-suite tests, a TypeScript recheck, and builds (including an isolated `.next-production` output) were attempted but the commands/workers were terminated with SIGTERM in this shared environment. Earlier Phase 6/7 TypeScript checks passed before the final lint-only/config/documentation adjustments. Phase 8 verification therefore remains incomplete until the full suite, typecheck, and production build can complete.

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

## Patient detail photo follow-up
- Display the patient's photo on the patient detail view when the API returns `imageUrl`; relative upload paths resolve against the configured API origin.
- Validation: focused patient detail and photo URL tests, frontend lint, and production build.

## Query and interaction performance
- Debounced patient, OPD visit, user, and audit actor text searches by 250 ms to avoid a request for each keystroke.
- Forwarded React Query cancellation signals to data-fetch requests so obsolete queries can be aborted, including patient lookup on OPD registration.
- Deferred OPD patient lookup until the receptionist enters a search term instead of loading a default patient page on screen entry.
- After patient creation, invalidate patient search caches without remounting the search panel, preserving its current search and filters.
- Added a unit test for the shared debounce behavior.
- Validation: focused tests pass (7 tests across 4 files), the changed query/search files pass targeted ESLint, and the production build passes. Full frontend lint remains blocked by four pre-existing errors in OPD registration initialization, auth initialization, and patient identifier input refs.

## Patient registration usability follow-up
- Changed optional Ghana phone validation and the phone input hint to require exactly 10 digits beginning with `0`.
- Added red required markers for names, gender, marital status, and the date-of-birth/age alternatives; clarified manual age entry and retained automatic age calculation when DOB is supplied.
- Added the 16 Ghana regions, Central Region defaults, Central Region administrative districts, Asikuma-Odoben-Brakwa town suggestions, and Odoben area suggestions. Location inputs accept custom text.
- Improved camera switching with a large one-tap control, pending-switch protection, and capture cropping/mirroring aligned to the live preview.
- Backend follow-up required: validate the Ghana phone format at the API boundary too.
- Validation: 23 focused tests pass, changed files pass targeted ESLint and TypeScript checking, and the frontend production build passes. Full frontend lint still reports the four pre-existing errors noted above.
- Follow-up: phone entry rejects values whose first digit is not `0`; marital status is required to match the existing backend contract; district/town/area suggestions use an accessible touch-friendly searchable picker with a large tap target and scrollable options instead of mobile-inconsistent datalists. Tapping the picker arrow displays all suggestions even when the current field already contains a value. Updated focused tests cover these behaviors.
- Follow-up: on authentication, fetch all pages of the existing patient-list endpoint, extract only region/district/town/area values, and cache those values in the browser for location suggestions. Patient registration immediately merges the new record’s location into the current browser cache; a failed login-time refresh keeps the existing cache and shows a form-level notice. No API changes were made.
- Cache validation: location-cache tests (3), location-suggestion tests (3), and phone helper tests (2) pass. Form/schema test workers and targeted lint/typecheck were intermittently terminated by the environment before completing; production build was not re-run during this follow-up.

## Patient registration and history UX (Phase 3 follow-up)
- Replaced the inactive “New patient” control with a prominent “Register new patient” action that opens a responsive, focus-managed form sheet; improved form hierarchy and mobile submit sizing.
- Added a distinct “Add from clinic records” action on the Patients page. It creates a patient-only record through the existing `/patients` endpoint and clearly tells staff that no OPD visit was created.
- New registrations without a photo use the existing transactional `/patients/with-opd` endpoint so the patient and first attendance are saved together. The endpoint accepts JSON only; when a photo is supplied, the frontend preserves photo upload through `/patients` and then creates the first visit through `/opd-visits`. If that second request fails, the patient remains saved and the UI clearly offers a direct way to finish the visit without re-registering the patient.
- Added town and area to patient search cards.
- Added paginated OPD history to patient details using the existing `/opd-visits?patientId=<patient UUID>` response, including visit remarks and a link to each visit detail.
- No backend files were changed. `/reports/opd-visits` omits remarks, so the frontend retrieves the matching visit details from the existing paginated `/opd-visits` endpoint and enriches the report without a backend change.
- Validation: 16 focused patient tests pass; changed patient files pass targeted ESLint; production build passes. Full `npm run lint` remains blocked by four pre-existing lint errors in OPD registration initialization, auth initialization, and patient identifier input refs.

## OPD visit workflow (Phase 4)
- Made `/opd-visits` the visit-history landing page with a clear Register visit action; kept `/opd-visits/list` as a compatibility route and moved registration to `/opd-visits/register`.
- Improved visit cards with town and the permanent OPD number without its `PT-` prefix. The OPD detail view shows the recorded timestamp beneath the attendance date and the patient’s original registration date separately.
- Improved patient selection feedback on the registration form, kept the selected patient UUID in the URL, added a Clear action and a confirmed Undo last visit action, and display a clear success confirmation after attendance is saved.
- No backend files were changed. Patient visit history and visit detail use existing remarks; the reports UI now enriches OPD report rows from existing `/opd-visits` results, including report display and export/print fields.
- Validation: focused OPD/patient tests pass (9 tests), changed OPD files pass targeted ESLint and TypeScript checking, and `npm run build` passes. Full `npm run lint` remains blocked by three pre-existing errors in auth initialization and patient identifier input refs.
- Remarks follow-up validation: report UI tests pass (4 tests), changed report files pass ESLint and TypeScript checks, and the production build passes.

## Current follow-up: location picker and report details
- Raised the location suggestion popup above the patient registration sheet so district/town options are visible and selectable.
- Kept patient registration as a mobile bottom sheet and restored a full-height right-side panel at desktop widths.
- Added recorded visit timestamps, visit totals across all rows matching the active report period and filters, and stripped the `PT-` prefix from OPD numbers in report tables and exports. Counts remain scoped to the selected report filters; selecting a year calculates that patient's visits in that year, not a fabricated visit number.
- Visit-count failures are surfaced in the report UI; print/export remain unavailable until required OPD details load.
- No backend changes were made. Visit timestamps and visit totals are composed from existing reports and OPD visit endpoints.
- Validation: 17 focused patient-form/report tests pass; standalone `tsc --noEmit`, targeted ESLint, and `git diff --check` pass. The production build compiled successfully but was terminated by the shared environment (exit 143) during its built-in TypeScript stage; standalone type-checking passed.
- Report flow follow-up: the report route now opens on Patient Registration Report, exposes the OPD Visit Report toggle, and shows the active period and filtered total. OPD rows join to existing visit-list results for remarks and recorded timestamps, while report rows remain visible if visit metadata cannot load. Reversed custom dates show an error and disable loading/export.
- Follow-up validation: 11 focused report/date tests pass; report ESLint, frontend `tsc --noEmit`, `git diff --check`, and production build pass. No backend files were changed.

## Patient picker and duplicate feedback follow-up
- Replaced the location picker’s portaled combobox with an inline keyboard-accessible suggestion list. Typing filters suggestions, the arrow button opens the full list, and Arrow Up/Down, Enter, and Escape work without relying on dialog portal positioning.
- When the API reports a possible duplicate (HTTP 409), registration now shows an in-panel “Possible existing patient” notice, highlights the matched OPD number, preserves entered form details, and lets staff close the form to review patient records. The backend remains unchanged.
- Validation: 12 focused patient registration tests pass; targeted ESLint, `tsc --noEmit`, and `git diff --check` pass.
- Simplified the duplicate notice and added direct actions to view the matched patient, register an OPD visit for them, or return to the form when they are a different person.
- Validation: six focused patient-page tests pass; frontend lint, type-check, and production build pass.
- Replaced the inline notice with a duplicate pop-up and a separate read-only side-by-side comparison. Closing the comparison returns to the duplicate pop-up.
- Added “Ignore new record” to stop registration and “Accept new record” to return to the form; registration proceeds only after the staff member submits again.
- Added explicit backend confirmation for the reviewed demographic match to both patient-only and patient-with-first-visit creation. Confirmation is tied to the matched patient ID; exact Ghana Card and NHIS matches remain blocked.
- Validation: eight focused patient-page tests pass; frontend lint, type-check, and production build pass; API TypeScript check and production build pass. API lint reports existing `any` errors in `patient.service.ts` and `patient.validator.ts`, outside this change.

## Reports usability follow-up
- Clarified retention and lapsed-patient definitions, the all-history scope, and the limitation caused by missing historical visits. Clarified that quiet-area comparisons are indicators of recorded activity, not confirmed service gaps, and removed the “A typical day” table.
- Filled town, district, region, and area for OPD report analytics from the linked patient in the existing OPD visit response; bumped the local report-cache schema so older cached rows are reloaded.
- Merged overlapping possible-duplicate matches into groups with unique patient IDs and combined reasons. The Records view now shows patient names, missing-field details, and possible-match peers; its search also finds names using the existing patient search endpoint while keeping results inside the loaded report scope.
- Redesigned report controls as a sticky, single-row horizontally scrollable toolbar below the mobile header. Saved views now explain what they store, use a save dialog, and restore section and record type as well as dates, comparison, and filters.
- No backend changes were made. Validation: 11 focused report tests pass, including location enrichment, duplicate grouping, name search, and actionable record details; targeted ESLint, frontend TypeScript, `git diff --check`, and production build pass.
- Follow-up: removed the Data quality report tab, consolidated refresh, filters, saved views, exports and print into a working actions menu outside any clipping scroll container, and compressed the sticky mobile controls into a single non-scrolling row. Custom date entry opens a compact dialog on phones. Validation: report page tests pass (8), targeted ESLint, frontend TypeScript and `git diff --check` pass.
- Removed the “Areas that went quiet” comparison section from the People and places report.

## Patient details and marital-status reports follow-up

## Patient other-name display follow-up
- Added optional other-name entry to patient registration and editing, and show it in the patient detail view.
- Use a shared full-name formatter in patient search cards, OPD patient selection, visit lists/details, and report records. Patient, OPD visit, and report searches advertise other-name search; the existing API search paths already support it.
- Added the patient report's separate Other name export field. Full-name fields in patient and OPD reports include the other name.
- No backend files were changed. Validation: 26 focused tests pass, frontend TypeScript and production build pass, and all changed files except the OPD visit list pass ESLint. That file retains its existing setState-in-effect lint error.
- Validation: 21 focused tests pass; frontend TypeScript, targeted ESLint, `git diff --check`, and production build pass.
