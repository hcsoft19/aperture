# Aperture

Mobile-first web app for medical aesthetic clinics to document treatment photographs, compare them over time, and share selected progress with patients.

This repository is through Phase 4: application shell, Supabase Auth, the clinical schema, row-level security, a role-aware workspace, clinic-scoped patient and treatment charts, and guided facial photography. There is no comparison engine yet.

## Requirements

- Node.js 22 or newer (the current Supabase and test packages declare that engine)
- npm

## Setup

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local` from your own Supabase project. Do not commit that file, and do not put the service-role key anywhere in this app.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase project

1. Create a free project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. In Project Settings → API Keys, copy the project URL and the publishable key into `.env.local`.
3. In Authentication → URL configuration, set the site URL to `http://localhost:3000`.
4. Add these redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/callback?next=/reset-password`
5. Enable the Email provider. Email confirmation can stay on. The app handles both a confirmed session and a "check your email" response.

The app will still open without these values. Sign-in shows a configuration message, and workspace routes send you back to sign-in.

Hosted projects also need the SQL in `supabase/migrations` applied with the Supabase CLI (`supabase db push`). Do not apply `supabase/seed.sql` to a project that will hold real patients. It is for the local database reset only.

## Local database

Docker is required. This project uses offset ports so it can run beside another local Supabase project:

| Service | URL |
| --- | --- |
| API | http://127.0.0.1:54421 |
| Database | postgresql://postgres:postgres@127.0.0.1:54422/postgres |
| Studio | http://127.0.0.1:54423 |
| Mailpit | http://127.0.0.1:54424 |

```bash
npx supabase start
npx supabase db reset
```

Point `.env.local` at `http://127.0.0.1:54421` and the local publishable key from `npx supabase status`. Leave the secret key out of the file.

The reset loads two synthetic accounts, both with the password `local-demo-password`:

- `ada.clinic@example.com` — clinic administrator of Example Aesthetic Studio
- `blake.patient@example.com` — linked to the synthetic chart Sam Rivera

A second clinic in the seed exists only to prove isolation. Do not reuse these accounts or this seed with real patients.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development |
| `npm run lint` | ESLint |
| `npm test` | Unit and component tests |
| `npm run build` | Production build |

## Clinical data

Do not upload real patient photographs or other health information to this prototype. Before any clinical deployment, review privacy, security, hosting, and LGPD obligations. Vercel Hobby is for personal, non-commercial use and is not the production plan.

## Next step

Phase 5 is comparison. See `docs/implementation-plan.md`. Do not start it until that phase is approved.
