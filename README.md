# Aperture

Mobile-first web app for medical aesthetic clinics to document treatment photographs, compare them over time, and share selected progress with patients.

This repository is through the MVP: clinic charts, guided facial photography, side-by-side comparisons, and a patient portal for released sessions and shared comparisons. A prototype is hosted for demonstration. It is not a clinical system.

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

## Hosted prototype

The public app is [https://aperture-hcsoft19-gmailcoms-projects.vercel.app](https://aperture-hcsoft19-gmailcoms-projects.vercel.app). The same deployment also answers at `https://aperture-sigma-gilt.vercel.app`. `https://aperture.vercel.app` is a different product and is not this app.

That deployment was built from `main` at the patient-portal commit. The blush landing page and the refined clinic home are on `development` and `production`, and they are not on the live site until those branches are deployed.

The hosted Supabase project is `aperture`, ref `pnsrvrsgbkafkqqrdxcx`, API `https://pnsrvrsgbkafkqqrdxcx.supabase.co`. Its database has the five migrations and the synthetic seed, including the two demo accounts below. Do not add real patients to it. Vercel has only the public URL, the publishable key, and `NEXT_PUBLIC_SITE_URL`. The service-role key is not in Vercel and must not be added.

Auth site URL is the Vercel hostname above. Redirects include `/auth/callback` and `/auth/callback?next=/reset-password` for that host, the alternate Vercel host, and local development.

## Local demonstration photographs

`local-photos/` holds synthetic front-facing before and after portraits for this machine only. The directory is gitignored. Do not commit or push those files, and do not treat them as patient records. A database reset does not put them back into Storage.

## Clinical data

Do not upload real patient photographs or other health information to this prototype. Before any clinical deployment, review privacy, security, hosting, and LGPD obligations. Vercel Hobby is for personal, non-commercial use and is not the production plan.

## Next step

The remaining work is the automated browser suite, a fuller access-control test pass, and a privacy review before any real clinical use. Read `docs/specification.md` before continuing. Do not deploy a newer branch, or put real patient photographs on the hosted project, without confirmation.
