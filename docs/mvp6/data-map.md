# Data map

Status: draft inventory for specialist review. 14 November 2026.

This data map is not an LGPD certification and not a lawyer's privacy impact assessment. A specialist review is still required before any real patient. No retention period and no lawful basis are decided here.

The inventory below describes tables and buckets that exist in `supabase/migrations` and the access code under `src/features/access` and `src/lib/supabase`. Photographs, names, and clinic names are personal data.

## Purposes in the product

`src/features/purpose-consent/purposes.ts` records three purposes on `public.consents`:

| Purpose | What the product uses it for |
| --- | --- |
| Clinical photography | Photographs kept on the patient's chart |
| Patient portal sharing | Photographs from that chart shown to the linked patient account |
| Marketing publication | Photographs from that chart used in marketing |

Each purpose can be granted and later revoked. Revocation writes `revoked_at`. The grant fields stay as they were. These rows show what the clinic recorded in the product. They do not, by themselves, establish a lawful basis.

## Who can see a record

The signed-in person is the JWT subject from `supabase.auth.getClaims()`. Clinic roles are read from `organization_members` (`clinic_admin` or `professional`). Patient links are read from `patient_accounts`. The app does not authorize from `getSession()` or from `user_metadata`.

Row Level Security is enabled on the tables below. Staff checks use `private.is_org_staff` or `private.can_staff_patient`. A patient sees their own chart only through `patient_accounts`, and sees a photograph only when `private.patient_can_view_photo` allows it: the linked patient, and either a session with `released_to_patient` or an unrevoked comparison with `shared_with_patient`.

## Categories

### Profiles

`public.profiles` is created when an Auth user is created. It stores the account id, an optional `full_name` (a name), and timestamps. A person can update their own profile. The id and `created_at` cannot be changed.

The email address and password credential live in Supabase Auth (`auth.users`), which this application does not store in `profiles`.

### Organization members

`public.organizations` stores the clinic name. That name is personal data.

`public.organization_members` stores which profile belongs to which clinic and the role `clinic_admin` or `professional`. Clients cannot insert clinics or members directly. `create_organization`, `add_organization_member`, `set_organization_member_role`, and `remove_organization_member` run as security-definer functions. Adding a member, changing a role, and removing a member require a clinic administrator. The last administrator cannot be removed or demoted.

### Patients

`public.patients` is the chart: `first_name`, `last_name`, optional `date_of_birth`, optional `contact_email`, optional `phone`, and the owning `organization_id`. Names, contact details, and the clinic name on the related organization are personal data.

`public.patient_accounts` links one patient row to one profile. Staff of that clinic, and the linked patient, can read the chart. Patients do not receive insert or update grants on the chart.

`public.patient_invitations` stores the invited email, a SHA-256 `token_hash`, who invited them, and an expiry. The raw invitation token is not stored. Acceptance inserts the `patient_accounts` row only when the signed-in email matches the invitation.

### Treatments

`public.treatments` stores the treatment name, category, body area, optional description, start date, and status (`planned`, `active`, `completed`, `cancelled`) for one patient. Staff of that clinic can insert and update treatments. Patients can read treatments on their own chart.

### Photo sessions

`public.photo_sessions` stores the session type (`baseline` or `follow_up`), protocol, date, notes, status (`draft`, `completed`, `cancelled`), and `released_to_patient`. A completed session can still change the release flag. Other fields on a completed session stay fixed. Cancelled sessions cannot be modified.

### Photos

`public.photos` stores one angle of a session: storage path, source (`camera` or `gallery`), dimensions, MIME type, byte size, SHA-256, capture time, and upload status (`pending`, `uploaded`, `failed`). The file constraints are JPEG, PNG, or WebP, at most 10 MB (10,485,760 bytes), and a shortest side of at least 1,000 pixels when both dimensions are present.

Once `upload_status` is `uploaded`, triggers reject changes to the file fields and reject deletion of the row. The original is immutable in the database. Pending rows can still be removed.

The photograph itself is personal data. The path is `{organization}/{patient}/{session}/{angle}/{photo}.{ext}`.

### Private storage bucket `clinical-photos`

The bucket is private (`public = false`). Allowed types are `image/jpeg`, `image/png`, and `image/webp`. The size limit is 10 MB.

Staff of the clinic named by the first folder can insert and read objects. They can delete an object only when no `photos` row with that path has `upload_status = 'uploaded'`. There is no update policy on this bucket. The browser uploads with `upsert: false`.

A linked patient can read an object only when `patient_can_view_photo` is true for the matching `photos` row. The app reads originals through signed URLs that last 180 seconds (`createSignedUrl` in the capture, editor, and portal queries).

### Consent

`public.consents` stores `patient_id`, `organization_id`, `purpose`, `granted_by`, `granted_at`, and `revoked_at`. Staff of that clinic insert a grant with `granted_by` set to the signed-in user. A later update may set `revoked_at`. The purpose, grant time, and grantor cannot be rewritten. Audit rows record `consent.granted` and `consent.revoked`.

The three product purposes are listed above. Marketing publication also has a separate record, `clinic_publication_permissions.consent_reference`, which is a short text note on a showcase result. That text is not a foreign key to `consents`.

### Progress releases

`public.progress_releases` points at one patient and either one comparison or one photo, records who released it, and can set `revoked_at`. Staff of the clinic insert and update these rows. The linked patient can read a release while `revoked_at` is null.

A progress-release row does not, by itself, change `patient_can_view_photo`. Patient access to the file in `clinical-photos` still depends on a released session or an unrevoked shared comparison.

### Capture quality metrics

`public.capture_quality_assessments` stores one assessment per uploaded photo: status (`good`, `warning`, `poor`, `unavailable`), detector (`face-detector` or `none`), warning codes, a short instruction, and a `metrics` object. The application schema allows normalized face center, face width and height, yaw, pitch, roll, sharpness, exposure, and stability. Pitch and roll are present and may be null.

The database rejects metric keys named `landmarks`, `embedding`, `template`, or `pixels`. The migration states that these rows do not store a copy of the photograph. The scores still describe a face in a clinical photograph. A specialist must decide how to classify them.

`public.capture_quality_overrides` stores a staff reason for overriding an assessment. Staff of the clinic can read and insert assessments and overrides. Patients are not granted these tables.

Detection runs in the browser. Camera frames, landmarks, and embeddings are not sent to a model host.

### Photo suggestions

`public.photo_suggestions` stores a suggestion kind (`framing`, `alignment`, `segmentation`, `recommendation`), heuristic version, optional model id, status (`suggested`, `accepted`, `rejected`), optional confidence, and a JSON payload of at most 4,000 bytes. The migration states that original photographs, pixels, landmarks, and embeddings are not stored here. Staff of the clinic can read and insert rows. There is no update or delete grant.

Language-model wording, when used, sends setup warning codes only. `assertTextOnly` rejects a `data:image` payload and a long base64 run before any call to OpenRouter.

## Flows

1. A person registers or signs in with email and password. Supabase Auth holds the credential. The app creates or loads `profiles`.
2. A clinic administrator creates an organization. The clinic name is stored on `organizations`, and that person becomes `clinic_admin`.
3. Staff create a patient chart and treatments, then record consent for one or more purposes.
4. Staff open a capture session, and the browser uploads the original to `clinical-photos`. The `photos` row stores the hash, size, and type. Uploaded originals stay immutable.
5. The browser may score the frame and store capture quality metrics. Those metrics stay in Postgres. The photograph is not sent to OpenRouter.
6. Staff may release a session, share a comparison, or insert a progress release so the linked patient can see the allowed records in the portal.
7. For marketing publication, a clinic administrator can publish a showcase result into the separate private bucket `clinic-showcase`, with a `consent_reference` string. Published showcase objects have a public read policy. That is a publication of photographs beyond the clinic and the patient.

## Processors

| Processor | What it holds in this product |
| --- | --- |
| Supabase Auth | Email and the password credential for the prototype project |
| Supabase Postgres | The tables in this map, including names, clinic names, charts, consent, and quality scores |
| Supabase Storage | Originals in `clinical-photos`. Related private buckets `photo-derivatives` and `clinic-showcase` hold presentation copies and published marketing images |
| Vercel | The Next.js application. `OPENROUTER_API_KEY`, when set, stays in server environment variables |
| OpenRouter | Optional wording of photography setup codes. Photographs, names, clinic names, and identifiers are not part of that request |
| The user's browser | Camera frames and on-device face detection, until an original is uploaded to Storage |

The service-role key is not read by the browser client. `src/lib/supabase/env.ts` accepts only the public URL and the publishable key.

## Retention and legal review

The migrations do not define a retention period, an erasure job, or a storage-deletion policy for uploaded originals. Database triggers refuse updates and deletes of an uploaded photograph. Some parent deletes cascade to child rows. That cascade is not a retention decision, and it is not described here as deleting the object in Storage.

The following decisions remain open until a specialist reviews them, before any real patient:

- Lawful basis for each purpose, including whether the consent rows are sufficient.
- Whether capture quality scores need a separate classification.
- How long each category is kept, and how an uploaded original would be erased.
- Which published marketing images must be withdrawn when consent is revoked.
- Which processors need a contract, and which transfers need a recorded decision.

Until that review is recorded elsewhere, this prototype must keep using synthetic data only.
