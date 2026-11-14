# Launch checklist

This is not a go decision. Production was not signed off.

## In the repository

- Deployment inventory, risks, and a checklist: `docs/mvp6/readiness.md`
- Data map that is not a legal assessment: `docs/mvp6/data-map.md`
- Auth notes. Hosted MFA was not changed: `docs/mvp6/auth-threat-model.md`
- Internal security checklist. No external test: `docs/mvp6/security-checklist.md`
- Recovery limits. No restore drill: `docs/mvp6/recovery.md`
- Scale notes. No load test: `docs/mvp6/scale.md`
- Export and deletion requests that do not delete photographs
- Append-only audit events for consent, sharing, and privacy requests
- Prototype storage limit. A new photograph is refused at the limit. Originals stay.
- CI typechecks and runs unit tests on `development`. It does not deploy.

## Still blocked

- FRA-58 specialist LGPD review
- FRA-61 hosted MFA and auth project settings
- FRA-63 paging and a health dashboard
- FRA-64 a spare database and a restore drill
- FRA-66 a billing provider
- FRA-69 a load test against a database that is not the demo
- FRA-70 an external penetration test and a dependency audit
- FRA-72 this sign-off
