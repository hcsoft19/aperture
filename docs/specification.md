# Aperture specification

Read this file before changing the product. It is the handoff for the next person or model. Phase status also lives in `docs/implementation-plan.md`. Day-to-day coding rules live in `AGENTS.md`.

## Product

Aperture is a mobile-first web app for one medical-aesthetics clinic to photograph a treatment, compare a later visit with the baseline, and share only the photographs the clinic releases. English interface. Light theme. Figtree is the typeface. The signed-in app uses warm neutral surfaces and a muted green accent. The public landing page uses a blush and wine palette.

A clinic must never see another clinic's records. A patient must never see another patient's records, unreleased sessions, or a comparison the clinic has not shared.

The working name is Aperture until a brand is chosen.

## Finished through the MVP

Phases 1 through 6 are implemented in this repository:

1. App shell, auth, and the first documentation.
2. Schema, row-level security, seed data, and a role-aware shell.
3. Clinic-scoped patient and treatment charts.
4. Guided facial capture. The camera loads `FACE_STANDARD` from the database. Originals upload straight to a private bucket and stay immutable.
5. Comparison of one baseline photograph and one follow-up of the same angle. Side-by-side view, a keyboard slider, and alignment metadata only. No smoothing, reshaping, or generated pixels.
6. Patient portal. A clinic can invite a patient, release a completed session, and share or revoke a comparison. The patient sees only that released material.
7. Public landing page and clinic home. The landing page explains the workflow and shows an interactive side-by-side, baseline, and follow-up preview. The clinic home offers the patient library, a new capture, and a new chart.

## Hosted prototype

| Item | Value |
| --- | --- |
| App | https://aperture-hcsoft19-gmailcoms-projects.vercel.app |
| Alternate app host | https://aperture-sigma-gilt.vercel.app |
| Vercel project | `aperture` on the `hcsoft19-gmailcoms-projects` team |
| Supabase project | `aperture`, ref `pnsrvrsgbkafkqqrdxcx` |
| API | https://pnsrvrsgbkafkqqrdxcx.supabase.co |
| Live git commit | `a4b13e4` on `main` |

`https://aperture.vercel.app` belongs to a different product. Do not set `NEXT_PUBLIC_SITE_URL` to it.

The hosted database has the five migrations and `supabase/seed.sql`. The demo accounts in the seed section below can sign in on the public URL. That was an explicit choice for this prototype. Do not add real patients, and do not copy that seed onto a project that will hold real records.

Vercel environment variables are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL`. The site URL is the first app host above. The service-role key is not stored there.

Supabase Auth site URL is that same host. The allow list includes `/auth/callback` and `/auth/callback?next=/reset-password` for both Vercel hosts and for `localhost:3000` and `127.0.0.1:3000`.

`development` and `production` are ahead of the live site. They contain the blush landing page and the refined clinic home. Deploying `production` is a separate confirmation. Do not assume a push to `production` updates Vercel; the current production deployment was created from `main`.

## Not finished

Phase 7 is partly open:

- A full row-level-security test suite.
- Playwright coverage for sign-in, clinic isolation, capture review, and comparison.
- An accessibility pass beyond the rules already in the UI.
- Deploying the `production` branch so the live site matches the latest interface.
- A privacy, security, legal, and LGPD review before any commercial or clinical launch. Vercel Hobby is not the clinical hosting plan.

Do not add a separate backend, a mobile app, or a new paid service. Do not put the Supabase service-role key in the repo or in a `NEXT_PUBLIC_` variable.

## Repository

The app git root is this directory. The parent folder `aesthetic_photos` is a different, empty git repository. Run git commands here.

Remote: `https://github.com/hcsoft19/aperture.git`. GitHub's default branch is `main`. `development` and `production` currently contain the later interface work. `main` and `phase-5-comparison` stop at the patient-portal commit, which is what Vercel is serving. Do not force-push.

Another local Supabase project, shiftshots, uses the default Supabase ports. Leave it running. Aperture uses the offset ports below.

## Stack and layout

- Next.js App Router with Cache Components and partial prefetching. Read the matching guide in `node_modules/next/dist/docs/` before using a Next.js API.
- TypeScript strict, Tailwind CSS, shadcn/ui, Lucide, Zod, React Hook Form, Vitest.
- Supabase Auth, Postgres, Storage, and `@supabase/ssr`. The proxy is `src/proxy.ts`. There is no `middleware.ts`.
- Business logic belongs in `src/features` and `src/lib`. `src/components` stays presentational.
- Authorize with `supabase.auth.getClaims()`. Do not authorize from `getSession()` or `user_metadata`.
- Clinic roles come from `organization_members`. Patient links come from `patient_accounts`.
- Read `cookies()` or `headers()` only inside `<Suspense>`. Pages that call `getWorkspace()` wrap the async content in `<Suspense>` because `getClaims()` reads the current time during prerender. `getWorkspace()` calls `connection()` from `next/server`.
- `params` and `searchParams` are Promises.
- Validate every mutation on the server. Show a plain error. Do not render database or auth internals.
- Touch targets stay at least 44px. Body text stays at least 16px. Every control has a visible name.
- Base UI buttons often render `type="button"`. Submit a form with `requestSubmit()` when a click does not submit it.

## Local setup

Node.js 22 or newer is required.

```bash
npm install
cp .env.example .env.local
npx supabase start
```

`.env.local` is gitignored. It holds only the local API URL and the publishable key. Leave the secret key out.

| Service | URL |
| --- | --- |
| App | http://localhost:3000 |
| API | http://127.0.0.1:54421 |
| Database | postgresql://postgres:postgres@127.0.0.1:54422/postgres |
| Studio | http://127.0.0.1:54423 |
| Mailpit | http://127.0.0.1:54424 |

`npx supabase db reset` reapplies migrations and `supabase/seed.sql`. The current hosted prototype also has that seed. Do not apply it to a project that will hold real patients.

Useful checks: `npm run lint`, `npm test`, and `npx tsc --noEmit`.

## Seed accounts and charts

Both seed passwords are `local-demo-password`. These accounts are synthetic.

| Email | Role |
| --- | --- |
| `ada.clinic@example.com` | Clinic administrator of Example Aesthetic Studio |
| `blake.patient@example.com` | Patient linked to Sam Rivera |

Stable seed ids:

| Record | Id |
| --- | --- |
| Ada | `11111111-1111-4111-8111-111111111111` |
| Blake | `22222222-2222-4222-8222-222222222222` |
| Example Aesthetic Studio | `33333333-3333-4333-8333-333333333333` |
| Sam Rivera | `44444444-4444-4444-8444-444444444444` |
| Other Clinic | `55555555-5555-4555-8555-555555555555` |
| Quinn Isolated | `66666666-6666-4666-8666-666666666666` |

Quinn belongs to Other Clinic and must stay hidden from Example Aesthetic Studio. The facial protocol `FACE_STANDARD` version 1 is `10000000-0000-4000-8000-000000000001`, with angles `front`, `left_45`, `right_45`, `left_90`, and `right_90`. Left and right mean the patient's left and right.

Local-only records created after the seed, including extra users, sessions, invitations, and Storage objects, disappear on `db reset`. Do not treat those ids as part of the source.

## Local photographs

`local-photos/before-front.jpg` and `local-photos/after-front.jpg` are synthetic studio portraits of a fictional person. They are the local before and after pair for the front angle. The directory is listed in `.gitignore`. Do not commit it, do not push it, and do not copy the files into `public/` or `supabase/seed.sql`.

On this machine those two files are also the objects behind Sam Rivera's uploaded front baseline and front follow-up in the local `clinical-photos` bucket. The comparison of that pair is shared with Blake. A database reset removes that link. Put the files back through the capture flow, or upload them to the private bucket and store the hash, dimensions, and size on the photo row. Do not bypass immutability in application code. The shortest side must be at least 1000 pixels, the file must be JPEG, PNG, or WebP, and it must be at most 10 MB.

Do not download or store photographs of a real patient. The landing page's committed file `public/demo-portraits.png` is a separate fictional marketing illustration. It is not a clinical photograph and it is not stored in the private bucket.

## Clinical behavior

Capture starts from a treatment. The server creates the session, then the photo row, then the browser uploads the original to `clinical-photos` with upsert disabled. Inserting the session and the photo in one statement fails row-level security because the photo policy cannot yet see the new session. The same pattern applies to any insert whose `SELECT` policy looks the new row up by its new id: `INSERT ... RETURNING` checks that policy before the row is visible. Point the policy at columns already on the new row, such as `organization_id` or `treatment_id`.

A follow-up can show the latest completed baseline of the same treatment and angle as a translucent guide. That guide is a signed URL. It is not saved as a new image. `reference_photo_id` and `overlay_opacity` are metadata.

Consent purpose is exactly `Clinical photography`, recorded before a photograph is accepted when none exists. An incomplete session needs a reason before it can be finished. Draft sessions can be deleted. Cancelled sessions cannot be changed. A completed session can change only `released_to_patient`.

Uploaded photographs cannot be replaced or deleted through the app. Storage delete is allowed only while no `photos` row with that path has `upload_status = uploaded`.

A comparison requires the same angle and the same treatment, a completed baseline, and a completed follow-up. Alignment is `{ x, y, rotation, scale, aligned }`. Saving updates the latest non-revoked row for that pair. The slider is a native range. The follow-up transform is CSS only.

Patient invitations live in `patient_invitations`. The raw token is shown once as `/invite/{token}` and only its SHA-256 hex is stored. It expires in seven days. One open invitation is allowed per patient. `public.accept_patient_invitation` is security invoker and calls the private definer function. It matches `lower(auth.email())` to the invitation and inserts `patient_accounts` when that patient has no account. A patient chart can link to one account. One account can link to more than one chart. Staff membership wins over a patient link when choosing the shell.

Anonymous visitors to `/invite/{token}` are sent to `/login?next=/invite/{token}`. The token must be 64 hex characters. After login, the auth proxy must honor that safe next path.

## Routes

Staff: Home, Patients, Capture, Profile. Patient: Home, Treatments, Profile.

- `/capture` and `/capture/[sessionId]` for guided photography.
- `/patients/[patientId]` for the chart and invitation.
- `/patients/[patientId]/treatments/[treatmentId]` for release, comparison, and sharing.
- `/treatments` and `/treatments/[treatmentId]` for the patient timeline.
- `/invite/[token]` to accept an invitation.

## Migrations

Apply new SQL with `supabase migration new <name>` and then edit that file. Do not invent a migration timestamp. Current files:

- `supabase/migrations/20261113204512_clinical_foundation.sql`
- `supabase/migrations/20261113211516_patient_chart_visibility.sql`
- `supabase/migrations/20261113212102_capture_session_visibility.sql`
- `supabase/migrations/20261113220000_restrict_patient_sessions.sql`
- `supabase/migrations/20261113221359_patient_portal.sql`

After a schema change, regenerate `src/types/database.ts` with `npx supabase gen types typescript --local --schema public`.

Security-definer helpers use an empty `search_path`. `pgcrypto` is in the `extensions` schema. A Node SHA-256 hex digest of a UTF-8 string matches `encode(extensions.digest(convert_to(text, 'UTF8'), 'sha256'), 'hex')`.

## How to continue

The prototype host already exists. Continue with the open Phase 7 checks, or deploy the `production` branch only after confirmation. Preserve clinic isolation, immutable originals, and the rule that patients see released sessions and unrevoked shared comparisons only. Keep new clinical demonstration images in `local-photos/` and out of git. Leave the hosted project free of real patient data.
