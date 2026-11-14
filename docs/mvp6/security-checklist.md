# Security checklist

Status: internal code review. 14 November 2026.

This checklist is an internal code review of the repository. An external penetration test did not occur. Do not describe this note as a penetration test, a dependency audit, or a completed remediation.

No automated security suite and no package audit were added with this note. Findings below are observations from the migrations and the application code. Items this lane cannot close are marked blocked.

## Access control

- Callers are verified with `supabase.auth.getClaims()` in `src/lib/auth/session.ts` and in `src/lib/supabase/proxy.ts`.
- Authorization does not use `getSession()` or `user_metadata`.
- Clinic roles live in `organization_members` and are read on the server in `getWorkspace`.
- Patient links live in `patient_accounts`. `private.is_patient_self` matches `patient_accounts.profile_id` to `auth.uid()`.
- Role changes go through `set_organization_member_role` and `remove_organization_member`, which require a clinic administrator and keep at least one administrator.
- Clinical tables enable and force Row Level Security. The proxy redirect is an extra gate, not the access check.
- Patient reads of a photograph go through `private.patient_can_view_photo`: the linked patient, plus a released session or an unrevoked shared comparison.

Observation: `progress_releases` lets the linked patient select an unrevoked release row. That policy does not replace `patient_can_view_photo` on `clinical-photos`. A release row and the storage object are separate checks.

## Private bucket

- `clinical-photos` is inserted as a private bucket (`public = false`) in `20261113204512_clinical_foundation.sql`.
- Staff insert and select are limited to objects whose first folder is an organization where `is_org_staff` is true.
- Patient select requires a `photos` row with the same path and `patient_can_view_photo`.
- Delete is limited to staff, and only when no `photos` row for that path is `uploaded`.
- Uploaded `photos` rows reject file-field updates and deletes in `guard_photo_update` and `guard_photo_delete`.
- The capture upload sets `upsert: false`.

Related private buckets exist and are out of the original-file path: `photo-derivatives` (presentation copies) and `clinic-showcase` (marketing images, with a public read policy only for published objects).

## Signed URLs

- Capture, editor, and portal queries call `createSignedUrl` on `clinical-photos` with a lifetime of 180 seconds.
- Those calls use the signed-in Supabase client, so Storage RLS still applies before a URL is issued.
- The URL is a bearer secret for those 180 seconds. The notes do not add a shorter lifetime or a one-time constraint.

## File type and size limits

The same limits appear in the bucket, the `photos` checks, and `describePhotograph`:

- MIME types: `image/jpeg`, `image/png`, `image/webp`.
- Maximum size: 10,485,760 bytes (10 MB).
- When width and height are stored, the shortest side is at least 1,000 pixels.
- SHA-256, when stored, must be 64 lowercase hex characters.
- The storage path must match `{organization}/{patient}/{session}/{angle}/{photo}.jpg|jpeg|png|webp`.

`photo-derivatives` allows JPEG and PNG, also at 10 MB. `clinic-showcase` allows WebP up to 5 MB. This checklist does not claim that image parsers were fuzzed.

## No service-role key in the client

- `src/lib/supabase/env.ts` reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only.
- `src/lib/supabase/client.ts` and `src/lib/supabase/server.ts` pass that publishable key to `@supabase/ssr`.
- A search of the application source found no `SERVICE_ROLE` or `service_role` client.
- The key must stay out of the repository and out of any `NEXT_PUBLIC_` variable. This review did not open the hosted dashboard to re-check deployed environment variables.

## No clinical image in language-model calls

- `completeWithFallback` calls `assertTextOnly` on the system and user text.
- `assertTextOnly` rejects text that contains `data:image` or a base64 run of 200 or more characters, and throws "Photographs cannot be sent to a language model."
- Setup recommendations send warning codes only. If the model reply is empty, unsafe, or not plain text, the local heuristic is kept.
- `OPENROUTER_API_KEY` is read from the server environment. The browser client does not receive it.
- `capture_quality_assessments` rejects metric keys `landmarks`, `embedding`, `template`, and `pixels`.
- `photo_suggestions` limits the payload to 4,000 bytes. The migration states that pixels, landmarks, and embeddings are not stored there.
- Computer vision stays on the device. Camera frames are not part of the OpenRouter request.

## Blocked

These items stay open. This note does not mark them fixed.

| Item | Why it is blocked |
| --- | --- |
| External penetration test | Not commissioned and not performed. |
| Automated security tests and a dependency audit | Not added in this change. No package install was run. |
| MFA, hosted Auth rate limits, and email templates | Project settings on the shared prototype. This lane must not change them. See `docs/mvp6/auth-threat-model.md`. |
| Legal sign-off before a real patient | See `docs/mvp6/data-map.md`. This checklist is not that review. |
| Content Security Policy and image-parser hardening | Not assessed as a code change here. |

No critical vulnerability was closed by this document, because this lane did not change application code. The controls listed above are already in the migrations and the access code. The blocked rows are the remaining gaps.
