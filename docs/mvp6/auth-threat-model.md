# Authentication threat model

Status: notes on the current application. 14 November 2026.

This document describes how sign-in, recovery, invitations, and clinic roles work in the repository. It does not change Supabase Auth settings. MFA, hosted rate limits, and email templates were not changed. Those are project settings this lane cannot safely apply on the shared prototype.

No authentication test was added with this note. This is not a penetration test.

## Assets

- The email and password credential in Supabase Auth.
- The session cookie used by the Next.js server and browser clients.
- Clinic roles in `organization_members` (`clinic_admin`, `professional`).
- Patient links in `patient_accounts`, created from `patient_invitations`.
- Clinical photographs and charts that those roles can reach.

## How a caller is identified

`getVerifiedUser` in `src/lib/auth/session.ts` calls `supabase.auth.getClaims()` and uses the `sub` claim. A missing or failed claim is signed out. The email claim is display data only.

Authorization does not use `getSession()` and does not use `user_metadata`. `getWorkspace` loads `organization_members` and `patient_accounts` on the server. If the same person has a staff membership and a patient link, the workspace kind is `staff`.

`src/lib/supabase/proxy.ts` also calls `getClaims()` and redirects anonymous users away from private paths. That redirect is a gate only. Server actions and Row Level Security still check the caller.

The browser and server Supabase clients are created with the publishable key from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The service-role key is not part of that client.

## Sign-in, registration, and sign-out

| Flow | What the app does |
| --- | --- |
| Sign in | `signInWithPassword` after a Zod check. Failures return a plain message. |
| Registration | `signUp` with `emailRedirectTo` set to `/auth/callback`. Password length is at least 8 characters. If Auth returns a session, the app sends the person to `/home`. Otherwise it asks them to confirm the email. |
| Sign out | `signOut` on the current client, then redirect to `/login`. |

Email confirmation therefore depends on the hosted project. If that project returns a session at sign-up, the app treats the account as signed in. This lane did not turn confirmation, MFA, or hosted rate limits on or off.

## Account recovery

`resetPasswordForEmail` sends the person to `/auth/callback?next=/reset-password`. The success message is the same whether or not an account exists: "If an account exists for that email, a reset link is on the way."

`updatePasswordAction` sets a new password with `updateUser` for the signed-in recovery session. The new password must be at least 8 characters and must match the confirmation field.

Recovery links, their lifetime, and the email body are hosted Auth settings. The templates were not changed. This note does not call recovery safe beyond the application behavior above.

## Invitations

Staff create a patient invitation for an email address. The database stores a SHA-256 `token_hash`, not the raw token. The raw token is returned to the staff member as `/invite/{token}`. `expires_at` is seven days from creation. One open invitation is allowed per patient. Staff can set `revoked_at`. Email, token hash, expiry, and the patient id cannot be edited later.

`accept_patient_invitation` requires a signed-in user, hashes the presented token, and returns `unavailable` when the invitation is missing, revoked, expired, or addressed to a different email than `auth.email()`. It inserts `patient_accounts` only when that patient is not already linked to someone else.

## Role changes

Membership changes go through security-definer functions:

- `add_organization_member` inserts a `professional` only when the caller is `clinic_admin` for that clinic, and only for an existing Auth email.
- `set_organization_member_role` updates the role only for a clinic administrator, and refuses to demote the last administrator.
- `remove_organization_member` deletes a membership only for a clinic administrator, and refuses to remove the last administrator.

Authenticated clients have `select` on `organization_members` and do not have a direct insert, update, or delete grant. A role in the JWT or in `user_metadata` is not read.

## Threats and current controls

| Threat | Control present in the app or migrations | Gap left open |
| --- | --- | --- |
| Forged clinic role in the client | Roles are loaded from `organization_members`. RLS uses `auth.uid()` inside `is_org_staff` and `is_org_admin`. | None recorded for this specific control. |
| Cross-clinic chart access | Patient policies use `can_staff_patient` and `is_patient_self`. Storage folders for `clinical-photos` start with the organization id. | A progress-release row is readable by the linked patient, while the file policy still uses `patient_can_view_photo`. The release row alone does not grant the object. |
| Stolen password | Password sign-in and an 8-character minimum. | MFA was not enabled. Hosted rate limits were not changed. The app has no extra sign-in throttle. |
| Session copied to another browser | Session cookies are the Supabase SSR cookies. `getClaims` verifies the access token. Sign-out clears the current client session. | No admin control in this app revokes every session for a user. MFA is not required. |
| Email enumeration on reset | The reset action returns one generic success message. | Sign-up and invitation errors can still reveal some states, such as an existing open invitation. Hosted Auth errors are mapped to plain text and were not re-tested here. |
| Invitation token leaked or replayed | Only the hash is stored. Acceptance checks expiry, revocation, and the signed-in email. | The raw link is shown to staff so they can pass it on. Link delivery is outside the app. |
| Privilege change by a professional | Role functions require `clinic_admin`. The last administrator is protected. | Hosted Auth settings can still ban or restore users outside this table. This lane did not review that dashboard. |
| Unsigned-in access to a private page | The proxy redirects to `/login`. | The proxy is not the authorization check. RLS and server actions are. |

## Settings this lane did not apply

On the shared prototype, the following stay as they already are in the hosted project:

- MFA enrollment and assurance level (`aal2`) are not required by `getClaims`.
- Hosted Auth rate limits were not edited.
- Email templates for confirmation and recovery were not edited.
- Whether sign-up must confirm email before a session exists was not edited.

Changing those settings would affect every user of the shared prototype. They need an owner decision and a maintenance window. Until then, production authentication is not complete, and this issue stays blocked.
