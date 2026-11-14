# Aperture agent factory

Lanes run at the same time. Each lane owns the paths below and does not edit another lane, migrations, `src/types/database.ts`, or the markdown guides. The integrator adds one migration, mounts the pages, runs the full test suite, then pushes `development` and merges it into `production` and `main`.

## Linear handoff

The lane that finishes an issue comments on it, checks only the acceptance criteria the work meets, and sets the issue to In Review. It does not mark the issue Done.

`.cursor/agents/linear-review.md` then reviews that issue against the repository. It marks Done only when the goal is in the product. A gap stays open with a comment.

## MVP 8 — universal background removal

| Lane | Owns | Issues |
| --- | --- | --- |
| Segmentation adapter | `src/features/editor/segmentation/`, `tests/unit/segmentation.test.ts` | FRA-84, FRA-86, FRA-92, FRA-93 |
| Background renderer | `src/features/editor/background-renderer.ts`, `tests/unit/background-renderer.test.ts` | FRA-87 |
| Editor UI | `src/features/editor/background-tool.tsx`, `src/features/editor/color-picker.tsx` | FRA-88 |
| Mask refinement | `src/features/editor/brush-correction.tsx`, `tests/unit/brush-correction.test.ts` | FRA-89 |
| Integration | Coordinates across lanes, handles schema and order of operations | FRA-85, FRA-90 |
| Storage and RLS | Migration for schema version 2, `segmentation_usage` table | FRA-91 |
| Validation | Test fixtures, performance benchmarks | FRA-94, FRA-95 |
| Rollout | Feature flag documentation, rollout plan | FRA-96 |

On-device segmentation only. No images sent to external services. Corrections stored as metadata. Masks regenerated on demand. Full plan in `docs/MVP8_IMPLEMENTATION_PLAN.md`.

## MVP 6 — production readiness

Lanes may write only the paths below. The integrator writes the migration, mounts pages, and does not let a lane close its own issue.

| Lane | Owns | Issues |
| --- | --- | --- |
| Readiness notes | `docs/mvp6/readiness.md`, `docs/mvp6/recovery.md`, `docs/mvp6/scale.md` | FRA-57, FRA-64, FRA-69 |
| Privacy and security notes | `docs/mvp6/data-map.md`, `docs/mvp6/auth-threat-model.md`, `docs/mvp6/security-checklist.md` | FRA-58, FRA-61, FRA-70 |
| Privacy requests | `src/features/privacy-requests/`, `tests/unit/privacy-requests.test.ts` | FRA-59 |
| Audit log | `src/features/audit-log/`, `tests/unit/audit-log.test.ts` | FRA-62 |
| Clinic usage | `src/features/clinic-usage/`, `tests/unit/clinic-usage.test.ts` | FRA-65, FRA-67 |
| Operations and support | `src/features/operations/`, `src/features/support/`, `tests/unit/operations.test.ts`, `tests/unit/support-readiness.test.ts`, `.github/workflows/ci.yml` | FRA-63, FRA-68, FRA-71 |

FRA-66 stays open. No billing provider is approved. FRA-60 and FRA-72 belong to the integrator. A blocked issue gets a Linear comment and stays out of Done.

## MVP 5 — photography intelligence

| Lane | Owns |
| --- | --- |
| Framing suggestions | `src/features/photo-intelligence/framing/`, `tests/unit/framing-suggestions.test.ts` |
| Assisted alignment | `src/features/photo-intelligence/alignment/`, `tests/unit/assisted-alignment.test.ts` |
| Quality recommendations | `src/features/photo-intelligence/recommendations/`, `src/lib/openrouter/`, `tests/unit/quality-recommendations.test.ts`, `tests/unit/openrouter-fallback.test.ts` |
| Session completeness | `src/features/photo-intelligence/completeness/`, `tests/unit/session-completeness.test.ts` |
| Segmentation prototype | `src/features/photo-intelligence/segmentation/`, `tests/unit/segmentation-prototype.test.ts` |
| Processing jobs | `src/features/photo-intelligence/jobs/`, `tests/unit/processing-jobs.test.ts` |

Suggestions are metadata. A professional accepts or rejects them. Original photographs stay immutable. Language tips use OpenRouter free models and fall back to the local sentences. Photographs are not sent to a model.

## MVP 4 — clinic operations

| Lane | Owns |
| --- | --- |
| Treatment templates | `src/features/treatment-templates/`, `/clinic/templates` |
| Patient timeline | `src/features/patient-timeline/`, `/patients/[patientId]/timeline` |
| Progress gallery | `src/features/progress-gallery/`, `/patients/[patientId]/progress` |
| Purpose consent | `src/features/purpose-consent/`, `/patients/[patientId]/consent` |
| Follow-up reminders | `src/features/follow-ups/`, `/clinic/reminders` |
| Work queue | `src/features/work-queue/`, `/clinic/queue` |
| Clinic reports | `src/features/clinic-reports/`, `/clinic/reports` |
| Collaboration | `src/features/collaboration/`, `/clinic/team` |
