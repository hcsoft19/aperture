import { describe, expect, it } from "vitest";

import { canCancelSession, canFinishSession, clinicalStoragePath } from "@/features/capture/rules";
import { preparePhotoSchema, startCaptureSchema } from "@/features/capture/schemas";

const TREATMENT = "89dfa023-0570-43b3-87ed-3ee308ae3d56";
const SESSION = "10000000-0000-4000-8000-000000000010";
const ANGLE = "10000000-0000-4000-8000-000000000011";
const HASH = "a".repeat(64);

describe("capture rules", () => {
  it("stores the original under the clinic, patient, session, and angle", () => {
    expect(
      clinicalStoragePath({
        organizationId: "33333333-3333-4333-8333-333333333333",
        patientId: "44444444-4444-4444-8444-444444444444",
        sessionId: SESSION,
        angleId: ANGLE,
        photoId: "10000000-0000-4000-8000-000000000012",
        mimeType: "image/jpeg",
      }),
    ).toBe(
      "33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444/10000000-0000-4000-8000-000000000010/10000000-0000-4000-8000-000000000011/10000000-0000-4000-8000-000000000012.jpg",
    );
  });

  it("requires a photograph and a reason when angles are missing", () => {
    expect(canFinishSession({ uploadedCount: 0, angleCount: 5, missingReason: "" })).toMatch(/at least one/);
    expect(canFinishSession({ uploadedCount: 2, angleCount: 5, missingReason: "no" })).toMatch(/missing/);
    expect(canFinishSession({ uploadedCount: 2, angleCount: 5, missingReason: "Patient left early" })).toBeNull();
    expect(canFinishSession({ uploadedCount: 5, angleCount: 5, missingReason: "" })).toBeNull();
  });

  it("lets an empty draft be discarded and asks for a reason after a photograph is saved", () => {
    expect(canCancelSession({ uploadedCount: 0, missingReason: "" })).toBeNull();
    expect(canCancelSession({ uploadedCount: 1, missingReason: "no" })).toMatch(/cancelled/);
    expect(canCancelSession({ uploadedCount: 1, missingReason: "Wrong patient chart" })).toBeNull();
  });

  it("accepts a photograph record without a reference", () => {
    const parsed = preparePhotoSchema.safeParse({
      sessionId: SESSION,
      angleId: ANGLE,
      source: "gallery",
      mimeType: "image/jpeg",
      width: 1200,
      height: 1600,
      fileSizeBytes: 120000,
      sha256: HASH,
      cameraFacing: null,
      overlayOpacity: null,
      referencePhotoId: null,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a session that has no treatment", () => {
    expect(startCaptureSchema.safeParse({ treatmentId: "nope", sessionType: "baseline", confirmConsent: false }).success).toBe(
      false,
    );
    expect(
      startCaptureSchema.safeParse({ treatmentId: TREATMENT, sessionType: "baseline", confirmConsent: true }).success,
    ).toBe(true);
  });
});
