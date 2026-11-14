import { describe, expect, it } from "vitest";

import { buildReport, type ReportInput } from "@/features/clinic-reports/report";

const approved = {
  clinicName: "Northshore Aesthetics",
  angleLabel: "Front",
  treatmentDate: "2026-03-12",
  approved: true,
  revoked: false,
  presentationEdited: false,
  marketingUse: false,
  marketingConsent: false,
} satisfies ReportInput;

describe("clinic reports", () => {
  it("rejects an unapproved comparison", () => {
    expect(buildReport({ ...approved, approved: false })).toEqual({
      ok: false,
      reason: "unapproved",
    });
  });

  it("rejects a revoked comparison", () => {
    expect(buildReport({ ...approved, revoked: true })).toEqual({
      ok: false,
      reason: "revoked",
    });
  });

  it("blocks marketing use without consent", () => {
    expect(
      buildReport({
        ...approved,
        marketingUse: true,
        marketingConsent: false,
      }),
    ).toEqual({
      ok: false,
      reason: "marketing_consent",
    });
  });

  it("includes the Presentation edit disclosure when the comparison was edited", () => {
    expect(buildReport({ ...approved, presentationEdited: true })).toEqual({
      ok: true,
      report: {
        clinicName: "Northshore Aesthetics",
        angleLabel: "Front",
        treatmentDate: "2026-03-12",
        marketingUse: false,
        disclosure: "Presentation edit",
      },
    });
  });

  it("allows marketing use when consent is recorded", () => {
    const result = buildReport({
      ...approved,
      marketingUse: true,
      marketingConsent: true,
    });

    expect(result).toEqual({
      ok: true,
      report: {
        clinicName: "Northshore Aesthetics",
        angleLabel: "Front",
        treatmentDate: "2026-03-12",
        marketingUse: true,
        disclosure: null,
      },
    });
  });

  it("never includes an original storage path", () => {
    const result = buildReport({
      ...approved,
      presentationEdited: true,
      storagePath: "clinic/patient/session/original.jpg",
      originalStoragePath: "clinical-photos/original.jpg",
      storage_path: "clinical-photos/original.jpg",
    });

    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/original\.jpg|storagePath|storage_path/);
    if (result.ok) {
      expect(Object.keys(result.report).sort()).toEqual([
        "angleLabel",
        "clinicName",
        "disclosure",
        "marketingUse",
        "treatmentDate",
      ]);
    }
  });
});
