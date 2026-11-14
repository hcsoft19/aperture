# MVP 3 — smart guided capture

Guidance sits beside the existing camera. It does not replace the checklist, and it never changes the original photograph.

## Decision

Framing uses the browser Face Detector when the browser provides it. Blur, exposure, and steadiness are measured from pixels on the device. MediaPipe Face Landmarker was not added: loading its model contacts another host during a clinical capture. When the detector is missing, guidance says so and capture continues.

Coordinates are fractions of the source frame, origin at the top left. The preview is not mirrored. Yaw is an approximate offset from the angle’s target, not a clinical measurement. Pitch and roll stay empty. Landmarks, embeddings, and image pixels are not stored.

`NEXT_PUBLIC_SMART_CAPTURE=off` restores the previous capture screen. A clinic administrator can also turn guidance off for that clinic.

## Data

`capture_quality_assessments` stores one score row per uploaded photograph. `capture_quality_overrides` stores the reason when a poor frame is kept. `organization_capture_settings` stores the clinic switch. Patients cannot read these tables.

## Files

- `src/features/capture/guidance/` — schema, pixel scores, sampling, and the live loop
- `src/features/capture/quality-actions.ts` — save a score or the clinic switch
- `src/features/capture/capture-wizard.tsx` — one instruction, a required reason for a poor frame, and the saved summary
- `supabase/migrations/20261114131207_capture_quality_assessments.sql`
