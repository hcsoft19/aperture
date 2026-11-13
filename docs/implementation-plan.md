# Implementation plan

Aperture is a multi-tenant, clinic-first web app. Professionals document aesthetic treatments with a versioned facial photography protocol, compare baseline and follow-up photographs, and release selected comparisons to patients. Patients never edit clinical records and never see another clinic's data.

The Next.js app is both the interface and the backend-for-frontend. Supabase provides Auth, Postgres, and private Storage. Authorization will live in Row Level Security and in server-side checks. The browser never receives the service-role key, and client-supplied roles are never trusted.

## Architecture

```text
Browser
  └─ Next.js App Router
       ├─ Server Components and Server Actions
       ├─ Route Handlers (auth callback, later uploads if needed)
       ├─ proxy.ts (session refresh and signed-in gate)
       └─ Supabase SSR client (publishable key, cookie session)
            ├─ Auth
            ├─ Postgres + RLS
            └─ Private Storage bucket clinical-photos
```

Feature code lives in `src/features`. Shared infrastructure lives in `src/lib`. Route files stay thin. Presentation components do not authorize data access.

Identity is the verified JWT subject from `getClaims()`. Clinic role will come from `organization_members`, not from `user_metadata`. A patient account links to one or more clinic-owned patient records through `patient_accounts`, and those links never cross organizations.

Photographs are immutable originals. Alignment, crops, and derivatives will be separate metadata. The reference overlay used while framing a follow-up is a display aid and must not be baked into the saved file.

## Roles

| Role | Scope |
| --- | --- |
| Clinic administrator | Clinic profile, professional membership, patients, settings, and records allowed by that membership |
| Professional | Patients, treatments, capture, comparisons, and explicit sharing inside their clinic |
| Patient | Invitation sign-in, own released sessions and comparisons, own sharing preferences |

A patient may attend more than one clinic. Those clinics do not see each other.

## Data model (Phase 2, applied locally)

`profiles`, `organizations`, `organization_members`, `patients`, `patient_accounts`, `treatments`, `photography_protocols`, `photography_angles`, `photo_sessions`, `photos`, `comparisons`, `consents`, `audit_events`.

UUID keys, foreign keys, timestamps, and indexes. RLS on every exposed table before any client query is allowed. Storage policies will match the same organization and patient rules. The `FACE_STANDARD` protocol and its five angles (`front`, `left_45`, `right_45`, `left_90`, `right_90`) are rows, with a version referenced by each session. Left and right mean the patient's left and right.

Completed sessions will not be silently editable. Consent is required before a photograph is accepted. Quality warnings in the first camera version are a manual checklist, not face detection.

## Phases

### Phase 1 — Foundation (this change)

- Next.js, TypeScript strict, Tailwind, ESLint, shadcn/ui
- Supabase browser client, server client, and session proxy
- Environment template without secrets
- Landing page, sign-in, registration, password reset request, and password update
- Professional workspace shell with bottom navigation and a desktop sidebar
- Placeholder home, patients, capture, and profile screens
- Vitest coverage for validation, public-route rules, and the sign-in form

Not included: SQL, RLS, organizations, patients, camera, comparisons, patient portal, deployment.

### Phase 2 — Database and authentication (this change)

Migrations for the tables above, profiles created from the auth user, organization bootstrap for the first professional, membership roles, and RLS that isolates organizations. Seed only synthetic people. Server-side role lookup switches navigation between the professional shell, the patient shell, and clinic setup. Membership changes go through security-definer functions. Audit rows cover clinic creation, membership, consent, session release, and comparison sharing.

Not included: patient and treatment screens, camera, comparisons, invitations, or a hosted project.

### Phase 3 — Patients and treatments

Patient and treatment create, edit, and search, scoped to the active clinic. Detail pages show photograph history. Zod schemas and server actions validate every save.

### Phase 4 — Guided facial photography

The camera loads the protocol version from the database. Browser camera with permission and incompatibility handling, rear camera by default, five angles, baseline guides, follow-up reference overlay that is not saved, review, retake, and direct-to-Storage upload of the original. Session statuses: draft, completed, cancelled. Incomplete sessions require a reason. Store hash, dimensions, source, and upload status. Clean up orphaned files. Quality checks are a manual checklist. Photography consent is recorded before a photograph is accepted.

### Phase 5 — Comparison

Select baseline and follow-up photos of the same protocol angle. Side-by-side and a keyboard-accessible slider. Manual translation, rotation, and uniform scale stored as metadata, with a visible "aligned" state. No smoothing, reshaping, or generated results.

### Phase 6 — Patient portal

Done. Invitations, account linking, revocable sharing, a patient timeline, and patient-only reads of released photos and comparisons. A completed session can be released or hidden. A saved comparison can be shared or revoked. The invitation link is shown to the clinic once and expires in seven days. The behavior, local data, and continuation notes are in `docs/specification.md`.

### Phase 7 — Quality and deployment

RLS tests, Playwright for sign-in, patient isolation, capture review, and comparison. Accessibility pass. Vercel deployment only after a non-production Supabase project is configured. Document that a commercial launch needs a privacy, security, legal, and hosting review, including LGPD.

## Security rules that start now

- Publishable key in the browser. Service-role key never ships.
- `getClaims()` for the signed-in user. `getSession()` is not an authorization check.
- Every later table in `public` gets RLS before use. No permissive development policies.
- Storage bucket `clinical-photos` will be private. Reads use short-lived signed URLs.
- Auth redirects accept only same-origin relative paths.
- User-facing errors stay generic. Auth codes are mapped, not printed raw.
- Development data stays synthetic.

## Assumptions

1. The working product name is Aperture.
2. The interface is English.
3. Registration creates an Auth user and a profile. It does not create a clinic, a role, or a patient. The signed-in person creates the clinic from Home.
4. Public registration stays open for clinic onboarding. Patient invitations are Phase 6.
5. Email confirmation follows the Supabase project setting.
6. The env variable is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. A legacy anon key can be pasted there until the project is rotated.
7. Node.js 22 or newer is required. The machine used for this scaffold was on Node 20.18, which is below the current package engines.
8. Local Supabase runs on offset ports because another local project already uses the defaults. No hosted project or production credentials were created.
9. The visual theme is a warm neutral surface with a teal accent. Light mode only.
10. Staff membership chooses the professional shell. A linked patient with no staff membership sees the patient shell. A new account sees clinic setup.
11. Playwright is deferred until Phase 7, when there is a workflow to drive.
12. Vercel Hobby and Supabase Free are for this prototype only, and not for real clinical data.

## Configuration still required

- For a hosted project: URL, publishable key, Auth redirect URLs, and `supabase db push` of the migrations. Do not push `supabase/seed.sql` to a project that will hold real patients.
- A non-production Supabase project before Phase 7 deployment. Do not deploy this prototype with real patient photographs.
- Local demonstration portraits stay in gitignored `local-photos/` and in the local Storage bucket. They are not part of the repository.
