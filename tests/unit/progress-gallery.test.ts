import { describe, expect, it } from "vitest";

import {
  canRelease,
  releaseRequestSchema,
  revoke,
  revokeRequestSchema,
  visibleToPatient,
  type ProgressRelease,
} from "@/features/progress-gallery/model";

const organizationId = "33333333-3333-4333-8333-333333333333";
const patientId = "44444444-4444-4444-8444-444444444444";
const comparisonId = "55555555-5555-4555-8555-555555555555";
const derivativeId = "66666666-6666-4666-8666-666666666666";
const releaseId = "77777777-7777-4777-8777-777777777777";
const otherReleaseId = "88888888-8888-4888-8888-888888888888";
const actorId = "11111111-1111-4111-8111-111111111111";
const clinicalPath =
  "33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444/10000000-0000-4000-8000-000000000010/10000000-0000-4000-8000-000000000011/10000000-0000-4000-8000-000000000012.jpg";
const derivativePath = `${organizationId}/${derivativeId}.jpg`;
const now = new Date("2026-11-14T13:36:00.000Z");

function release(overrides: Partial<ProgressRelease> = {}): ProgressRelease {
  return {
    id: releaseId,
    organizationId,
    patientId,
    comparisonId,
    photoId: null,
    releasedBy: actorId,
    revokedAt: null,
    createdAt: "2026-11-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("canRelease", () => {
  it("releases a comparison or a derivative and refuses an original", () => {
    expect(canRelease({ kind: "comparison", id: comparisonId })).toBe(true);
    expect(canRelease({ kind: "derivative", id: derivativeId })).toBe(true);
    expect(canRelease({ kind: "derivative", id: derivativeId, storagePath: derivativePath })).toBe(
      true,
    );
    expect(canRelease({ kind: "original", id: comparisonId, storagePath: clinicalPath })).toBe(
      false,
    );
    expect(canRelease({ kind: "comparison", id: comparisonId, storagePath: clinicalPath })).toBe(
      false,
    );
    expect(canRelease({ kind: "derivative", id: derivativeId, storagePath: clinicalPath })).toBe(
      false,
    );
    expect(canRelease({ kind: "derivative", id: derivativeId, storagePath: "clinical-photos/original.jpg" })).toBe(
      false,
    );
    expect(canRelease({ kind: "comparison", id: "not-an-id" })).toBe(false);
    expect(canRelease({ kind: "original", id: derivativeId })).toBe(false);
  });
});

describe("revoke", () => {
  it("stamps the revocation time without changing the original record", () => {
    const current = release();
    const revoked = revoke(current, now);

    expect(revoked.revokedAt).toBe(now.toISOString());
    expect(revoked.id).toBe(current.id);
    expect(current.revokedAt).toBeNull();
    expect(visibleToPatient([revoked], now)).toEqual([]);
  });
});

describe("visibleToPatient", () => {
  it("hides a revoked or missing release and returns only ids", () => {
    const future = new Date(now.getTime() + 60_000);
    const derivativeRelease = release({
      id: otherReleaseId,
      comparisonId: null,
      photoId: derivativeId,
      storagePath: derivativePath,
    });

    expect(
      visibleToPatient(
        [
          release({ storagePath: clinicalPath }),
          derivativeRelease,
          release({ id: "99999999-9999-4999-8999-999999999999", revokedAt: now.toISOString() }),
          release({ comparisonId: null, photoId: null }),
          release({ comparisonId, photoId: derivativeId }),
          null,
          undefined,
          { id: "missing" },
          { storagePath: clinicalPath },
        ],
        now,
      ),
    ).toEqual([{ comparisonId }, { derivativeId }]);

    const encoded = JSON.stringify(
      visibleToPatient(
        [release({ storagePath: clinicalPath }), derivativeRelease],
        now,
      ),
    );
    expect(encoded).not.toContain(clinicalPath);
    expect(encoded).not.toContain(derivativePath);
    expect(encoded).not.toContain("storagePath");
    expect(encoded).not.toContain("clinical-photos");

    expect(visibleToPatient([release({ revokedAt: future.toISOString() })], now)).toEqual([
      { comparisonId },
    ]);
    expect(visibleToPatient([release({ revokedAt: future.toISOString() })], future)).toEqual([]);
    expect(visibleToPatient([release()], new Date("not-a-date"))).toEqual([]);
  });
});

describe("progress release requests", () => {
  it("requires exactly one comparison or derivative", () => {
    expect(
      releaseRequestSchema.safeParse({ patientId, comparisonId, derivativeId: "" }).success,
    ).toBe(true);
    expect(
      releaseRequestSchema.safeParse({ patientId, comparisonId: "", derivativeId }).success,
    ).toBe(true);
    expect(
      releaseRequestSchema.safeParse({ patientId, comparisonId, derivativeId }).success,
    ).toBe(false);
    expect(releaseRequestSchema.safeParse({ patientId, comparisonId: "", derivativeId: "" }).success).toBe(
      false,
    );
    expect(revokeRequestSchema.safeParse({ patientId, releaseId }).success).toBe(true);
    expect(revokeRequestSchema.safeParse({ patientId, releaseId: "nope" }).success).toBe(false);
  });
});
