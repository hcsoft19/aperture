# Production readiness

This note inventories the deployment that already exists. Production was not changed by this note. Nothing was deployed, migrated, or edited on Vercel or on the hosted database.

## Deployment

Aperture is a Next.js app. Authentication, Postgres, and Storage are Supabase. Vercel production serves the `main` branch.

| Item | Value |
| --- | --- |
| Vercel project | `prj_KyyAsjoOKxp0sPpJaXlSOksEZifW` |
| Public hosts | `https://aperture-hcsoft19-gmailcoms-projects.vercel.app`, `https://aperture-sigma-gilt.vercel.app` |
| Other host | `https://aperture.vercel.app` is a different product |
| Supabase project | `aperture`, ref `pnsrvrsgbkafkqqrdxcx` |
| Supabase plan in use | Free prototype. This database is also the demo |
| Local Supabase | A separate stack from the hosted project |

Vercel production environment names are only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

The service-role key is not in Vercel. `OPENROUTER_API_KEY` is optional and server-only, and it is not set on Vercel. This note did not read or print secret values.

## Application boundaries already in the product

MVP 1 through 5 are already shipped: charts, capture, editor, comparisons, portal sharing, clinic operations, and on-device suggestions.

Clinical photographs stay in the private `clinical-photos` bucket. The bucket is not public. Staff policies allow insert and select. Originals are immutable. The prototype has no real patient data.

The app verifies the caller with `supabase.auth.getClaims()` in `src/lib/auth/session.ts`. Clinic membership is read on the server from `organization_members`.

## Launch risks

1. The hosted database is a free prototype and the demo. Backup coverage on that plan is unknown. There is no spare restore target, so recovery was not drilled. See `docs/mvp6/recovery.md`.
2. A concurrency load test was not run. Benchmarks were not measured. See `docs/mvp6/scale.md`.
3. `https://aperture.vercel.app` is a different product. A launch check has to confirm the live alias is one of the two hosts above.
4. Vercel production serves `main`. This note is on the `development` working tree and is not a production release.
5. The service-role key stays out of Vercel and out of any `NEXT_PUBLIC_` variable.
6. `OPENROUTER_API_KEY` is unset on Vercel, so language-model features stay on the local heuristic. If a key is added later, it stays server-only. Photographs, patient names, clinic names, and identifiers stay off the model request.
7. Real patient records stay off this prototype.
8. Originals stay immutable. Deleting an original is not a recovery step.

Logging in the app is `src/features/operations/sanitize-error.ts`. A message that contains an email, a UUID, a bearer token, or a data URL is replaced with “Something went wrong.” There is no log vendor and no paging. CI is `.github/workflows/ci.yml`: pull requests and pushes to `development` run the typecheck and unit tests on Node 22. That workflow does not deploy, and it does not set branch protection.

## Launch checklist

- [x] Deployment inventory recorded in this file
- [x] Risk register recorded in this file
- [x] Production was not changed by this note
- [ ] Confirm the public alias is one of the two Aperture hosts, and not `https://aperture.vercel.app`
- [ ] Confirm Vercel production still serves `main`
- [ ] Confirm production environment names are still only the three listed above
- [ ] Confirm the service-role key is still absent from Vercel
- [ ] Keep `OPENROUTER_API_KEY` unset, or server-only if it is added later
- [ ] Keep clinical photographs in the private bucket
- [ ] Keep real patient data off this prototype
- [ ] Finish a nonproduction restore drill on a spare target before treating recovery as available
- [ ] Measure concurrency away from the demo database before any scale claim
- [ ] Add an index only after a real query plan justifies it

## Release sequence

These are gates. This note completed only the first.

1. Inventory and checklist. Done here. Production stays as it was.
2. Recovery. Needs a spare restore target, then a nonproduction drill. The free prototype does not provide that target.
3. Scale. Needs a load test that is not run against the demo database, then indexes only from a real query plan.
4. Release. Vercel production continues to serve `main`. Shipping these notes still requires the usual merge. This note does not deploy.
