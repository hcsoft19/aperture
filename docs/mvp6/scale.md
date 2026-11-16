# Scale

Production was not changed by this note. No index, cache, or query was added.

## Benchmarks

Benchmarks were not measured. A concurrency load test was not run against the hosted database because that free prototype is also the demo. This note records no timings, request rates, error rates, or storage-cost figures.

The hosted project remains the free prototype. Its project id is kept out of this repository. Vercel production serves the `main` branch of the Next.js app.

## Likely hot paths

These names come from the current code. They are not measurements.

- Patient list. `listPatients` in `src/features/patients/queries.ts` reads `patients` for one organization, ordered by name, with a limit of 200. The page is `/patients`.
- Signed photo URLs. Reads create signed URLs for the private `clinical-photos` bucket. Editor, capture, and portal URLs last 180 seconds (`src/features/editor/queries.ts`, `src/features/capture/queries.ts`, `src/features/portal/queries.ts`). Gallery URLs last 900 seconds (`src/features/gallery/queries.ts`).
- Clinic queue. `listWorkQueue` in `src/features/work-queue/queries.ts` loads draft sessions, recent completed sessions, and patients for one organization. The page is `/clinic/queue`.

## Indexes

Indexes must be justified by a real query plan before they are added. No query plan was captured for this note, so no index change is proposed.

## Cache

This note does not add a cache. A cross-tenant cache leakage test was not run. Signed URLs are created per request for a private object. Clinical photographs and chart rows stay out of a shared public cache.

## Acceptance status

Benchmarks and bottlenecks are not recorded, because they were not measured. Indexes are not justified, because no query plan was captured. Cross-tenant cache leakage was not tested.
