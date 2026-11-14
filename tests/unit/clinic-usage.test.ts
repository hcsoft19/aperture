import { describe, expect, it } from "vitest";

import {
  PROTOTYPE_STORAGE_LIMIT_BYTES,
  admitPhotograph,
  assignPrototypePlan,
  downgradeLimit,
  exportUsage,
  measureUsage,
  quotaMessages,
  requestPaidCheckout,
  type StoredPhotograph,
} from "@/features/clinic-usage/usage";

const CLINIC_A = "clinic-a";
const CLINIC_B = "clinic-b";

function photo(
  id: string,
  organizationId: string,
  fileSizeBytes: number | null,
): StoredPhotograph {
  return { id, organizationId, fileSizeBytes };
}

function usageStatusFor(fileSizeBytes: number) {
  const measured = measureUsage({
    organizationId: CLINIC_A,
    photographs: [photo("size", CLINIC_A, fileSizeBytes)],
  });

  if (!measured.ok) {
    throw new Error("expected a usage total");
  }

  return measured.usage.status;
}

describe("clinic usage", () => {
  it("assigns the prototype plan to every clinic and refuses paid checkout", () => {
    expect(assignPrototypePlan([CLINIC_A, CLINIC_B, CLINIC_A])).toEqual({
      ok: true,
      entitlements: [
        {
          organizationId: CLINIC_A,
          planId: "prototype",
          storageLimitBytes: PROTOTYPE_STORAGE_LIMIT_BYTES,
          paidCheckout: false,
          features: { usage_export: true, paid_export: false },
        },
        {
          organizationId: CLINIC_B,
          planId: "prototype",
          storageLimitBytes: PROTOTYPE_STORAGE_LIMIT_BYTES,
          paidCheckout: false,
          features: { usage_export: true, paid_export: false },
        },
      ],
    });

    expect(requestPaidCheckout(CLINIC_A)).toEqual({
      ok: false,
      reason: "paid_billing_unavailable",
      message: quotaMessages.paidBilling,
    });
  });

  it("warns from 80 percent through the storage limit", () => {
    expect(usageStatusFor(399_999_999)).toBe("ok");
    expect(usageStatusFor(400_000_000)).toBe("warning");
    expect(usageStatusFor(PROTOTYPE_STORAGE_LIMIT_BYTES)).toBe("warning");

    const belowWarning = measureUsage({
      organizationId: CLINIC_A,
      photographs: [photo("small", CLINIC_A, 7)],
      limitBytes: 10,
    });
    const atWarning = measureUsage({
      organizationId: CLINIC_A,
      photographs: [photo("edge", CLINIC_A, 8)],
      limitBytes: 10,
    });

    expect(belowWarning.ok && belowWarning.usage.status).toBe("ok");
    expect(atWarning.ok && atWarning.usage.status).toBe("warning");

    const existing = [photo("before", CLINIC_A, 100)];
    const admitted = admitPhotograph({
      organizationId: CLINIC_A,
      photographs: existing,
      incoming: photo("after", CLINIC_A, PROTOTYPE_STORAGE_LIMIT_BYTES - 100),
    });

    expect(admitted).toMatchObject({
      ok: true,
      accepted: true,
      refusal: null,
      status: "warning",
      usedBytes: PROTOTYPE_STORAGE_LIMIT_BYTES,
      deletedCount: 0,
      hiddenCount: 0,
    });

    if (admitted.ok && admitted.accepted) {
      expect(admitted.photographs.map((item) => item.id)).toEqual(["before", "after"]);
    }
  });

  it("refuses a photograph above the limit without deleting or hiding originals", () => {
    const photographs = [
      photo("original-1", CLINIC_A, 300_000_000),
      photo("original-2", CLINIC_A, 150_000_000),
    ];
    const before = photographs.map((item) => ({ ...item }));

    const refused = admitPhotograph({
      organizationId: CLINIC_A,
      photographs,
      incoming: photo("new", CLINIC_A, 100_000_000),
    });

    expect(photographs).toEqual(before);
    expect(refused).toEqual({
      ok: true,
      accepted: false,
      refusal: "above_limit",
      message: quotaMessages.aboveLimit,
      status: "warning",
      usedBytes: 450_000_000,
      unknownSizeCount: 0,
      limitBytes: PROTOTYPE_STORAGE_LIMIT_BYTES,
      photographs,
      deletedCount: 0,
      hiddenCount: 0,
    });

    const stored = [photo("original", CLINIC_A, PROTOTYPE_STORAGE_LIMIT_BYTES + 1)];
    const blocked = admitPhotograph({
      organizationId: CLINIC_A,
      photographs: stored,
      incoming: photo("another", CLINIC_A, 1),
    });

    expect(blocked).toMatchObject({
      ok: true,
      accepted: false,
      refusal: "above_limit",
      status: "blocked",
      usedBytes: PROTOTYPE_STORAGE_LIMIT_BYTES + 1,
      deletedCount: 0,
      hiddenCount: 0,
      photographs: stored,
    });

    if (blocked.ok) {
      expect(blocked.photographs.every((item) => !("hidden" in item))).toBe(true);
    }
  });

  it("counts null sizes as zero and reports them separately", () => {
    const photographs = [
      photo("known", CLINIC_A, 100),
      photo("missing", CLINIC_A, null),
      photo("also-missing", CLINIC_A, null),
      photo("other-missing", CLINIC_B, null),
      photo("other-known", CLINIC_B, 40),
    ];

    expect(measureUsage({ organizationId: CLINIC_A, photographs })).toEqual({
      ok: true,
      usage: {
        organizationId: CLINIC_A,
        planId: "prototype",
        limitBytes: PROTOTYPE_STORAGE_LIMIT_BYTES,
        usedBytes: 100,
        unknownSizeCount: 2,
        status: "ok",
        photographIds: ["known", "missing", "also-missing"],
      },
    });

    const admitted = admitPhotograph({
      organizationId: CLINIC_A,
      photographs,
      incoming: photo("new-missing", CLINIC_A, null),
    });

    expect(admitted).toMatchObject({
      ok: true,
      accepted: true,
      usedBytes: 100,
      unknownSizeCount: 3,
      deletedCount: 0,
      hiddenCount: 0,
    });
  });

  it("keeps every stored photograph when the limit is downgraded", () => {
    const photographs = [
      photo("keep-1", CLINIC_A, 80_000_000),
      photo("keep-2", CLINIC_A, 20_000_000),
      photo("unknown", CLINIC_A, null),
    ];

    expect(
      downgradeLimit({
        organizationId: CLINIC_A,
        photographs,
        nextLimitBytes: 50_000_000,
      }),
    ).toEqual({
      ok: true,
      photographs,
      deletedCount: 0,
      hiddenCount: 0,
      usage: {
        organizationId: CLINIC_A,
        planId: "prototype",
        limitBytes: 50_000_000,
        usedBytes: 100_000_000,
        unknownSizeCount: 1,
        status: "blocked",
        photographIds: ["keep-1", "keep-2", "unknown"],
      },
    });

    expect(
      downgradeLimit({
        organizationId: CLINIC_A,
        photographs,
        nextLimitBytes: PROTOTYPE_STORAGE_LIMIT_BYTES,
      }),
    ).toMatchObject({
      ok: false,
      reason: "not_smaller",
      photographs,
      deletedCount: 0,
      hiddenCount: 0,
    });
  });

  it("keeps each clinic's storage total separate", () => {
    const photographs = [
      photo("a1", CLINIC_A, 400_000_000),
      photo("b1", CLINIC_B, PROTOTYPE_STORAGE_LIMIT_BYTES + 1),
      photo("b-null", CLINIC_B, null),
    ];

    expect(measureUsage({ organizationId: CLINIC_A, photographs })).toEqual({
      ok: true,
      usage: {
        organizationId: CLINIC_A,
        planId: "prototype",
        limitBytes: PROTOTYPE_STORAGE_LIMIT_BYTES,
        usedBytes: 400_000_000,
        unknownSizeCount: 0,
        status: "warning",
        photographIds: ["a1"],
      },
    });

    expect(measureUsage({ organizationId: CLINIC_B, photographs })).toEqual({
      ok: true,
      usage: {
        organizationId: CLINIC_B,
        planId: "prototype",
        limitBytes: PROTOTYPE_STORAGE_LIMIT_BYTES,
        usedBytes: PROTOTYPE_STORAGE_LIMIT_BYTES + 1,
        unknownSizeCount: 1,
        status: "blocked",
        photographIds: ["b1", "b-null"],
      },
    });
  });

  it("allows a usage export and keeps paid export unavailable", () => {
    const photographs = [
      photo("a1", CLINIC_A, 10),
      photo("b1", CLINIC_B, 999),
    ];

    expect(exportUsage({ organizationId: CLINIC_A, photographs })).toEqual({
      ok: true,
      export: {
        feature: "usage_export",
        organizationId: CLINIC_A,
        planId: "prototype",
        usedBytes: 10,
        unknownSizeCount: 0,
        limitBytes: PROTOTYPE_STORAGE_LIMIT_BYTES,
        status: "ok",
        photographCount: 1,
      },
    });

    expect(
      exportUsage({
        feature: "paid_export",
        organizationId: CLINIC_A,
        photographs,
      }),
    ).toEqual({
      ok: false,
      reason: "unavailable",
      message: quotaMessages.paidExport,
    });
  });
});
