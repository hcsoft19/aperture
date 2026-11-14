# Row-level security inventory

This is a reading of the migrations. It is not a new cross-tenant test run, and it is not a hosted advisor review.

Clinical tables enable and force row-level security. Staff checks use `private.is_org_staff` or `private.is_org_admin`. Patient reads of a photograph go through `private.patient_can_view_photo`. The `clinical-photos` bucket is private. The service-role key is not in the browser.

`audit_events` already exists and is append-only. Clinic administrators can read it. Inserts go through `private.log_audit`. `record_readiness_audit` and `record_privacy_request` allow only the readiness actions and a short status. `privacy_requests` lets a clinic administrator read the clinic’s rows. There is no update or delete policy, and the status can only be `requested`.

What is still open: an automated test that a second clinic is denied, and a triage of the hosted security advisors.
