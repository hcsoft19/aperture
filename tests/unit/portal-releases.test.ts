import { describe, expect, it } from "vitest";

import type { ProgressRelease } from "@/features/progress-gallery/model";
import {
  portalComparisonVisible,
  releasedComparisonIds,
  visibleComparisonIdsForTreatment,
} from "@/features/portal/patient-comparisons";

const comparisonId = "55555555-5555-4555-8555-555555555555";
const otherComparisonId = "99999999-9999-4999-8999-999999999999";
const treatmentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const now = new Date("2026-11-14T13:36:00.000Z");

function release(overrides: Partial<ProgressRelease> = {}): ProgressRelease {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    organizationId: "33333333-3333-4333-8333-333333333333",
    patientId: "44444444-4444-4444-8444-444444444444",
    comparisonId,
    photoId: null,
    releasedBy: "11111111-1111-4111-8111-111111111111",
    revokedAt: null,
    createdAt: "2026-11-01T12:00:00.000Z",
    ...overrides,
    derivativeId: overrides.derivativeId ?? null,
  };
}

function comparison(
  overrides: Partial<{
    id: string;
    treatmentId: string;
    sharedWithPatient: boolean;
    revokedAt: string | null;
  }> = {},
) {
  return {
    id: comparisonId,
    treatmentId,
    sharedWithPatient: false,
    revokedAt: null,
    ...overrides,
  };
}

describe("patient treatment comparisons", () => {
  it("includes an unrevoked progress release of a comparison", () => {
    const released = new Set(releasedComparisonIds([release()], now));

    expect(released.has(comparisonId)).toBe(true);
    expect(portalComparisonVisible(comparison(), released)).toBe(true);
    expect(visibleComparisonIdsForTreatment(treatmentId, [comparison()], [release()], now)).toEqual([
      comparisonId,
    ]);
  });

  it("hides a revoked progress release", () => {
    const revoked = release({ revokedAt: now.toISOString() });
    const released = new Set(releasedComparisonIds([revoked], now));

    expect(released.has(comparisonId)).toBe(false);
    expect(portalComparisonVisible(comparison(), released)).toBe(false);
    expect(visibleComparisonIdsForTreatment(treatmentId, [comparison()], [revoked], now)).toEqual([]);
  });

  it("hides a comparison that was not released and is not shared", () => {
    expect(portalComparisonVisible(comparison(), new Set())).toBe(false);
    expect(visibleComparisonIdsForTreatment(treatmentId, [comparison()], [], now)).toEqual([]);
  });

  it("keeps a shared comparison and ignores an edited-photograph release", () => {
    const photoRelease = release({
      comparisonId: null,
      photoId: null,
      derivativeId: "66666666-6666-4666-8666-666666666666",
    });

    expect(releasedComparisonIds([photoRelease], now)).toEqual([]);
    expect(
      portalComparisonVisible(comparison({ sharedWithPatient: true }), new Set()),
    ).toBe(true);
    expect(
      visibleComparisonIdsForTreatment(
        treatmentId,
        [comparison(), comparison({ id: otherComparisonId, sharedWithPatient: true })],
        [release()],
        now,
      ),
    ).toEqual([comparisonId, otherComparisonId]);
  });
});
