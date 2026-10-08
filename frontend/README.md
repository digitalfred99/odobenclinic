# Odoben Health Center Frontend

This frontend implements the clinic’s patient registration, OPD attendance, dashboard, reports, user management, and audit-log flows using the existing backend API contract.

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form + Zod
- date-fns
- lucide-react
- Vitest + Testing Library + Playwright

## Local setup

1. Create a local environment file from the example template if needed:

```bash
cp .env.local.example .env.local
```

2. Start PostgreSQL using the settings in `api/.env`, then start the backend on port 3000.
3. Run the frontend on port 3001:

```bash
npm install
npm run dev
```

The app uses the same-origin `/api/v1` proxy by default; Next.js forwards API and patient-upload requests to the backend on port 3000. Set `NEXT_PUBLIC_API_BASE_URL` only when you intentionally need to bypass that proxy.

## Useful scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
```

## Theme

Theme tokens live in the app styling layer and can be adjusted in the shared design tokens used by the clinic UI.

## Notes

- The UI never exposes the internal super-admin role label.
- Auth uses the backend’s token refresh flow with a single-flight refresh guard.
- Role-based access remains enforced by the API and mirrored in the UI.
