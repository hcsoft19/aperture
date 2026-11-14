# Aperture agent factory

Lanes run at the same time. Each lane owns the paths below and does not edit another lane, migrations, or `src/types/database.ts`. The integrator adds one migration, mounts the pages, runs the full test suite, then pushes `development` and merges it into `production` and `main`.

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

After the lanes finish, one integrator wires the shared tables, checks the suite, and a separate pass confirms the deployed Vercel URL.
