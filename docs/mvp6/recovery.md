# Recovery

Production was not changed by this note. The hosted database was not dumped, restored, or rewound. Storage objects were not copied or deleted.

## What is known

The hosted database is the Supabase project `aperture`, ref `pnsrvrsgbkafkqqrdxcx`. It is a free prototype, and it is also the demo. Local Supabase is a separate stack. A local database is not a backup of the hosted project.

Clinical photographs stay in the private `clinical-photos` bucket. Originals are immutable. Staff storage policies allow insert and select. They do not allow those originals to be replaced or deleted. The prototype has no real patient data.

The service-role key is not in Vercel. This note did not print secrets.

## Backup coverage

Backup coverage is unknown on the free plan. This note does not claim point-in-time recovery. A tested restore is not claimed. Numeric RPO and RTO are not stated, because they were not measured.

## What was not drilled

A nonproduction restore drill was not run because this prototype has no spare restore target.

Storage recovery was not drilled. Database recovery was not drilled.

## Recovery rule for photographs

Originals must not be deleted as a recovery step. Replacing an original is not a recovery step. A later restore needs a spare target that is not this demo, and it has to leave private originals in place.

## Acceptance status

Storage and database recovery coverage is explicit: both are undrilled, and free-plan backup coverage is unknown. A tested nonproduction restore is still outstanding. Numeric RPO and RTO remain unstated.
