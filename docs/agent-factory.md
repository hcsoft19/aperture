# Aperture agent factory

Lanes run at the same time. Each lane owns the paths below and does not edit another lane, migrations, `src/types/database.ts`, or the markdown guides. The integrator adds one migration, mounts the pages, runs the full test suite, then pushes `development` and merges it into `production` and `main`.

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
