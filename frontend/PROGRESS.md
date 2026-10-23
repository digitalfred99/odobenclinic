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
- Print follow-up: created a clinic-branded A4 portrait OPD visit document, hid page actions and loading/error controls when printing, tightened the details layout, and kept print sections together to fit a single page.
- Validation: OPD detail test passes, full frontend lint, TypeScript check, and production build pass. Physical printer/browser output can still vary with unusually long remarks or printer settings. No backend files were changed.

## Patient list photo display
- Added patient avatars to search-result cards, positioned at the top-right on mobile and before patient details on larger screens.
- Added a 56px avatar size, using the existing photo URL resolution and failed-image fallback behavior.
- Validation: patient-search and avatar tests (10), full frontend lint, TypeScript check, production build, and `git diff --check -- frontend` pass.

## Clinic favicon and social images
- Replaced the starter favicon with a custom multi-size (16, 32, 48, and 256px) clinic heartbeat ICO and added a matching scalable SVG icon.
- Added a 180×180 Apple touch icon and a 1200×630 branded Open Graph/Twitter image using the same heart mark.
- Added `NEXT_PUBLIC_SITE_URL` metadata-base configuration and documented setting the production site origin.
- Validation: production build generated all icon/social-image routes; full lint and TypeScript check pass.

## Dashboard CSS compilation fix
- Replaced the dashboard's Tailwind arbitrary `calc(var(--sticky-offset))` utilities with a named responsive CSS rule to avoid Tailwind generating a malformed escaped CSS selector in development.
- Preserved the mobile header offset and desktop top offset for the sticky registration actions.
- Validation: dashboard regression test, full frontend lint, TypeScript check, production build, and `git diff --check -- frontend` pass; the running dev server returns HTTP 200 for `/patients` and `/dashboard`.

## Touch-device input focus zoom
- Kept the standard scalable device-width viewport and set text inputs, selects, and textareas to at least 16px on touch devices to prevent mobile Safari's automatic focus zoom.
- Left pinch/manual zoom available; no `maximum-scale` or `user-scalable=no` restrictions were added.
- Validation: full lint, TypeScript check, production build, and `git diff --check -- frontend` pass; the login route serves HTTP 200 with `width=device-width, initial-scale=1` and unrestricted user zoom.

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

## Patient creation endpoint and visit-details follow-up
- Routed ordinary registration through the transactional `/patients/with-opd` create request for both photo and no-photo submissions; both request formats include the visit date, and remarks are omitted when blank. The response type now models both the patient and created OPD visit.
- Added registration-only visit date and remarks fields before the photo section. The date defaults from the local calendar, rejects future dates, and is sent in `YYYY-MM-DD` form.
- Routed “Add from clinic records” through `/patients` only, with required year and number-in-year inputs, validation, a live `PT-{position}/{year}` preview, and flat JSON or multipart fields.
- Centralized typed creation request serialization. Kept multipart boundaries browser-generated, enforced JPEG/PNG/WebP and 5 MB client-side rules, and reused duplicate review/confirmation only for `patient_exists`. Government-ID conflicts remain blocked; duplicate paper-book numbers highlight both number fields.
- The form has no wizard or separate summary step; the new visit section follows personal details and precedes photo capture, and visit data is included in duplicate-comparison details.
- No backend files were changed.
- Validation: 51 focused patient/date/photo tests pass, modified workflow files pass targeted ESLint and frontend TypeScript checks, and `npm run build` passes. Full `npm run lint` remains blocked by two existing errors in untouched `src/app/(app)/dashboard/page.tsx` and `src/components/features/opd/opd-visit-list.tsx`.

## Patient registration draft-retention follow-up
- Kept patient-registration and clinic-record-entry drafts, including selected photos, in page state when the dialog is dismissed by clicking outside or using its close button. Reopening each flow restores its own draft; successful creation clears it.
- Added a confirmed Clear form action to remove all entered values and the selected photo intentionally.
- Validation: 26 focused page/form tests pass; changed files pass targeted ESLint, frontend TypeScript, `git diff --check`, and production build.

## Shared data refresh follow-up
- Added a shared Refresh action to authenticated pages other than the dashboard, which retains its existing refresh control. The action refetches active TanStack Query data in place, preserves page state, prevents duplicate refreshes, and reports success or failure.
- Added up to two short retries for network errors and transient HTTP 408/429/5xx query failures; client errors are not retried.
- Validation: four focused tests pass; changed files pass targeted ESLint, frontend TypeScript, `git diff --check`, and production build.
- Scoped refresh feedback to the route where refresh was requested so success/failure messages do not appear on unrelated pages, including when an earlier request finishes after navigation.

## Patient registration validation and close-control follow-up
- Kept an icon-only, accessibly named close action present in the sticky registration header, including after a validation banner appears.
- Removed the draft-retention note from the registration header.
- Separated server validation feedback from other registration errors so any edit or clearing of a form field dismisses stale validation feedback; age/date-of-birth mapped errors clear together.
- Added a regression test for the age/date-of-birth mismatch and clearing the affected input.

## Session loading screen refresh
- Replaced the auth/session loading skeleton with an Odoben Health Center loading scene featuring a heartbeat icon, expanding pulse rings, and animated progress dots.
- Respects reduced-motion preferences and uses existing theme tokens.

## OPD patient photo display
- Show a patient’s photo in the selected-patient summary and the “More” details header, keeping the existing circular avatar dimensions and falling back to the user symbol when no photo is available or the image fails to load.
- Reused the shared patient-photo URL resolver; added coverage for photo display in both locations.

## Mobile responsiveness follow-up
- Reviewed the authenticated app visually at 360px and 390px phone widths, plus 768px, 1024px, and 1440px layout breakpoints. Checked the dashboard, patient list and registration sheet, OPD list/registration/detail, patient detail, reports, users, audit logs, profile, and change-password dialog. No page-level horizontal overflow or clipped dialog controls were found; the viewport/client-width difference is the vertical scrollbar gutter.
- Wide users and audit tables and report navigation tabs remain locally horizontally scrollable; report records use stacked cards on phones.
- Improved the OPD “More” dialog for phone widths: patient identity now gets a full-width row beneath the avatar/close controls, names wrap instead of being clipped, and patient facts use one column before switching to two columns at `sm`.
- Validation: phone-width screenshots and DOM measurements confirmed the page/document width stays within the viewport across the checked routes; the responsive markup and avatar tests pass. No additional layout changes were warranted.

## OPD patient details dialog positioning
- Changed the OPD registration “More” dialog from a bottom sheet to a centered modal on phones, matching the other centered dialogs. It keeps a bounded height and scrollable content while leaving the heading and close button in the persistent header.
- Added a regression assertion that the phone layout does not restore bottom-sheet positioning.
- Validation: the dialog was visually checked at 360px and 390px phone widths and remains centered; focused OPD registration tests pass, changed files pass ESLint, and `git diff --check` passes.

## Consistent close-button appearance
- Added a shared close button matching the patient-registration X control: circular card background, soft shadow, 40px touch target, and consistent X icon sizing.
- Applied it to patient registration/duplicate/comparison dialogs, OPD patient details, the mobile navigation drawer, and dismissible feedback messages. Search-clear and delete/remove X actions retain their distinct action styling.
- Added close-button style assertions and a focused shared-component test.

## Modal background interaction blocking
- Explicitly enabled modal behavior on each Base UI dialog and made every dialog backdrop capture pointer and touch input across the viewport. This prevents background clicks and touch scrolling while a modal is open.
- Applied the same touch blocking to camera overlays and native OPD visit dialog backdrops; native `showModal()` blocks background interaction.
- Browser inspection confirmed the registration backdrop covers the full viewport, captures pointer input, disables touch scrolling, locks body scrolling, and marks the underlying page inert.
- Validation: focused patient, reports, password-dialog, and camera tests pass (29 tests); changed files pass ESLint, frontend TypeScript, and `git diff --check`.

## Patient edit photos and editable fields
- Enabled the shared camera/upload controls while editing a patient and previewed the existing photo; no replacement keeps the current photo, while a new photo is uploaded as `image` on the existing PATCH endpoint.
- Patient edits now send only backend-supported editable fields, with JSON for ordinary edits and flat multipart fields plus the image for photo replacement. Generated patient-number fields and visit data are excluded.
- The backend's multipart parser deliberately ignores empty text fields. If an edit clears a previously populated optional field while also replacing the photo, the form asks staff to save the cleared field first without a photo; otherwise that clear would silently be lost. JSON edits can clear nullable fields.
- Added coverage for the edit-mode current-photo preview, JSON field payload, and multipart serialization.
- Validation: focused patient edit/form/helper tests pass (24 tests), frontend TypeScript passes, changed patient files pass ESLint, and `git diff --check -- frontend` passes.

## OPD patient-details modal mobile layout
- Root cause: the native dialog had only a `max-height` while its flex header, scrollable details region, and footer were all shrinkable. A flex item with a zero basis and no definite available height can collapse differently across mobile browser engines, and the header also used an extra identity row on narrow screens. Browser emulation additionally showed wheel/touch scroll chaining could move the page behind the native dialog, including when scrolling over the footer.
- Set a definite, safe-area-aware mobile dialog height using the dynamic viewport with a `vh` fallback; kept the header/footer from shrinking and let the details/history region take the remaining height and scroll independently. Locked and restored the document scroll position for the modal lifetime, and contained overscroll within the details/history region.
- Placed the avatar, patient identity, and close control together in the mobile header to eliminate the unnecessary second row. Desktop sizing and positioning remain unchanged.
- Added regression assertions for the dialog class, non-shrinking header/footer, independently scrollable content, and document-scroll restoration on close.
- Browser-emulation measurements at 320×568, 360×640, 375×667, 390×568, 390×700, and 390×844 showed a 264–515 px scroll region, with the footer below the content and no overlap. Verified scrolling reaches the end of the history, wheel scrolling over both content and footer does not move the page while open, and normal page scrolling resumes after close. This was browser emulation, not a physical iPhone test.
- Validation: the focused OPD registration test passes, frontend TypeScript and targeted ESLint pass, `npm run build` succeeds, and `git diff --check` passes.

## Consistent branded loading screen
- Replaced the root route’s old “Redirecting you to the right place” card with the shared Odoben heartbeat/pulse loading screen. The root redirect, public login guard, and protected-route guard now all render the same component while resolving session/redirect state.
- Added a focused accessible rendering test for the shared loading screen.
- Validation: the loading screen test passes, frontend TypeScript and targeted ESLint pass, production build passes, and browser navigation to `/` visibly shows the branded heartbeat before redirecting to the authenticated destination.

## Backend-aligned password checklist
- Replaced the outdated single-line password hint with a live, accessible checklist that marks each satisfied requirement in the success token and shows an all-ready message once complete.
- Aligned client validation with `user.validator.ts`: 8–72 characters, no whitespace, lowercase and uppercase letters, a number, and one backend-approved special character.
- Applied a plain, live checklist to staff creation, admin password resets, and password changes. The change-password UI additionally requires lowercase and uppercase letters at the user's request; the current auth backend validator enforces at least 8 characters, one number, and one allowed special character.
- Removed the checklist heading, instructional copy, whitespace/maximum-length labels, background, and border at the user's request. Staff creation/reset and password change now check whitespace and the 72-character maximum before making the API request, with specific inline messages; other unlisted password rules remain backend-enforced.

## Patient fields, reports, and users filters follow-up
- Added `otherName`, email, postal address, occupation, and required religion to patient creation/edit payloads and views. Patient names continue to use the shared full-name formatter; religion uses the backend enum labels.
- Added religion to patient search filters and marital-status/religion filters to both reports. Report filters are sent to the backend and reset pagination; patient registration report columns and exports include the new fields.
- Added debounced user search, role and active-status filters, clear-search behavior, and page resets when filters change.
- Made the approved minimal backend change to forward marital-status and religion parameters from the OPD report route to its service.
- Validation: 33 focused patient/report tests pass; frontend TypeScript, production build, targeted ESLint for changed files, and `git diff --check -- frontend` pass. The full frontend suite had 6 failures before the related test fixtures/assertions were updated; the three task-related failures now pass in focused runs. Full-suite failures also included unrelated dashboard, OPD visit search-label, and patient-identifier tests. Full-project ESLint remains blocked by existing setState-in-effect errors in the dashboard and OPD visit list.

## Report cache staleness follow-up
- Revalidate saved historical patient and OPD report ranges against the API on each report load instead of treating IndexedDB coverage as authoritative. A successful empty server response replaces the old cached range and is rendered empty even if updating IndexedDB fails.
- Keep saved summaries as an offline fallback only when the API request fails due to network or transient server errors, and show a warning that fallback data may be out of date. Explicit refresh does not fall back to saved summaries.
- Updated the report cache helper text to describe offline fallback rather than implying cached summaries are authoritative or used for faster online loading.
- Added regression tests for stale patient and OPD cache rows alongside an empty server response, plus the clearly warned offline fallback.
- Validation: report loader tests (6) pass; frontend TypeScript and targeted ESLint pass.
- Backend password validation messages from user creation/reset and password change are surfaced inline beside the relevant password field, including for validation rules not represented by the client checklist.
- Validation: focused password and user-form tests, TypeScript, targeted ESLint, production build, and `git diff --check` pass.

## Consistent modal close-button focus
- Audited visible X-icon controls: dialog, sidebar, and dismissible-message close actions use the shared `CloseButton`; OPD search clearing, selected-patient clearing, report chip removal, and saved-view deletion are distinct actions and remain unchanged. The camera dialog uses a labeled Cancel action rather than an X.
- The OPD patient-details X already used the shared close component, but native-dialog autofocus placed a visible focus ring around it on open, making it look different from patient registration. Initial focus now goes to the dialog title; keyboard users can Tab to the close control as usual.
- Validation: OPD registration regression test, TypeScript, targeted ESLint, and diff check pass. Browser inspection confirms title focus on open and the close control remains the shared 40px circular, shadowed button without an automatic focus ring.

## OPD page refresh alignment
- Aligned the shared refresh control with the centered `max-w-6xl` content on the OPD visit list and registration pages; other pages retain the full content-column alignment.
- Audited the dashboard’s separate refresh action and the reports refresh action; both remain aligned within their own content/card layouts.
- Validation: refresh-control tests pass (4 tests), TypeScript and targeted ESLint pass, and desktop browser measurements at 1600px confirm the OPD list, OPD registration, and patient-list refresh rows align with their content edges.

## Frontend quality and performance audit
- Removed effect-driven duplicate state from dashboard date handling and OPD visit results. Dashboard summary data now uses a stable query key; OPD results retain the prior page through TanStack Query placeholder data.
- Memoized patient-location option derivation and indexed report detail rows by date and patient ID to avoid repeated list scans while rendering.
- Replaced hard-coded login-gradient and selection colors with shared theme tokens.
- Updated stale test expectations and fixtures to match current required patient fields, accessible filter labels, dashboard links, and responsive report markup.
- No backend changes were needed or made.
- Validation: all 42 test files pass (187 tests), full ESLint, `tsc --noEmit`, production build, and `git diff --check -- frontend` pass. Vitest still emits its existing config-loader compatibility warning.

## Patient image failure fallback
- Added a shared patient-photo image component that displays the app's profile-avatar fallback when a photo fails to load, including patient details, registration/edit previews, and camera captures. A changed photo URL is retried.
- The OPD and patient-list avatar already had its own failed-image fallback; audited image elements to confirm all patient-photo displays are covered.
- Validation: image fallback and avatar tests (5), targeted ESLint, TypeScript check, production build, and `git diff --check` pass.

## Patient report record-check follow-up
- Removed the separate "Other name" column from the patient report table; the formatted patient name remains.
- Extended Record checks to include missing email, religion, postal address, and occupation alongside existing fields, with each missing value shown in the expandable details.
- Added regression coverage for incomplete and complete patient records and verified the report table no longer has an "Other name" column.
- Validation: report-table tests (4), targeted ESLint, TypeScript check, and `git diff --check -- frontend` pass.

## Missing-details popover follow-up
- Updated the missing-details count badge to show the actual number and standardized the label to "{count} missing details".
- Clicking the trigger keeps the popover open; clicking inside it also keeps it open, while pointer interaction elsewhere dismisses it.
- Validation: report-table tests (4), targeted ESLint, TypeScript check, and `git diff --check -- frontend` pass.

## Patient missing-details clarification
- Added a discreet note beneath the missing-field list in both desktop and mobile record checks: "These details were not provided by the patient."
- Adjusted desktop popover placement to account for the added note.
- Validation: report-table tests (4), targeted ESLint, TypeScript check, and `git diff --check -- frontend` pass.

## Missing-details note styling
- Visually separated the patient clarification from missing-field items with a subtle muted background, inset padding, and italic muted text using theme tokens.
- Validation: report-table tests (4), targeted ESLint, TypeScript check, and `git diff --check -- frontend` pass.

## Printed report header color consistency
- Made print table header cells explicitly use the primary theme background and foreground colors with print color adjustment, including sortable header text.
- Added a print-flow regression assertion for the selected-field header styling.
- Validation: report page tests (9), targeted ESLint, and `git diff --check -- frontend` pass.

## Print report page-fit follow-up
- The selected-field print table could exceed the landscape page width because columns had no fixed-layout wrapping rules; long headings and values could be clipped.
- Constrained the print table to the printable width, enabled fixed layout and aggressive text wrapping, reduced print cell spacing/font size, and allowed rows to paginate naturally.
- Validation: report page tests (9), targeted ESLint, TypeScript check, and `git diff --check -- frontend` pass.

## Patient form iOS validation and button feedback
- Disabled automatic focus on invalid patient-form fields so iOS does not leave native selects focused without opening their picker; inline validation remains visible and fields can be selected normally.
- Added a subtle press scale to shared buttons with reduced-motion support.
- Added regression tests for the gender validation flow and button press styling.
- Validation: patient-form and button tests (18), full frontend lint, TypeScript check, production build, and `git diff --check -- frontend` pass.

## First-invalid-field scrolling
- Added a shared helper to smoothly scroll the first invalid visible form control to the center of the viewport without moving focus; reduced-motion preferences use immediate scrolling.
- Applied it to patient validation (including server field errors), login, user/profile validation, and password-change validation. Missing OPD patient selection scrolls back to the patient search field.
- Added regression coverage for first-field ordering, reduced motion, explicit target scrolling, and the patient form's no-focus scroll behavior.
- Validation: focused form suite (44 tests), full frontend lint, TypeScript check, production build, and `git diff --check -- frontend` pass.

## Patient list and detail avatars
- Patient search cards always show the profile avatar instead of patient photos; OPD patient selection continues to show photos.
- Patient detail displays the patient photo when present and the profile avatar in its place when no photo is recorded.
- Added regression tests for list avatar behavior and the no-photo patient detail state.
- Validation: avatar, patient search, and patient detail tests (18), full frontend lint, TypeScript check, production build, and `git diff --check -- frontend` pass.

## Patient photo preview modal polish
- Redesigned the photo preview header to show a clear "Patient photo" label, the patient's name, and OPD No. when available.
- Framed the image in a responsive, bordered container with contained scaling and mobile-aware modal dimensions.
- Validation: patient detail tests (7), full frontend lint, TypeScript check, production build, and `git diff --check -- frontend` pass.

## Connectivity failure feedback
- Normalized fetch and interrupted response-body connection failures into a typed network error with clear retry guidance; request aborts and API validation/server errors remain distinct.
- Added an app-wide, dismissible notice for offline state, failed connectivity, and restored connection; network errors remain eligible for the existing bounded query retries.
- Kept mutations from auto-retrying to avoid duplicate writes; users are prompted to retry the failed action after reconnecting.
- Added tests for connection errors/events, offline/online notices, cancellation handling, and bounded query retry.
- Validation: network tests (7), full frontend lint, TypeScript check, production build, and `git diff --check -- frontend` pass.
