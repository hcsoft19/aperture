import { describe, expect, it } from "vitest";

import { CONSENT_VERSION, consentVersion } from "@/features/purpose-consent/purposes";
import {
  consentAllows,
  createConsentRecord,
  withdraw,
} from "@/features/purpose-consent/rules";
import { consentDecisionSchema } from "@/features/purpose-consent/schema";

const grantedAt = new Date("2026-11-01T15:00:00.000Z");
const withdrawnAt = new Date("2026-11-14T15:00:00.000Z");
const afterward = new Date("2026-11-14T15:01:00.000Z");
const staffId = "11111111-1111-4111-8111-111111111111";

describe("purpose consent", () => {
  it("marketing is false when only clinical photography is granted", () => {
    const clinical = createConsentRecord({
      purpose: "Clinical photography",
      grantedBy: staffId,
      grantedAt,
    });

    expect(CONSENT_VERSION).toBe(1);
    expect(clinical.version).toBe(consentVersion("Clinical photography"));
    expect(clinical.version).toBe("Clinical photography 1");
    expect(clinical.grantedBy).toBe(staffId);
    expect(clinical.revokedAt).toBeNull();
    expect(consentAllows([clinical], "Clinical photography", withdrawnAt)).toBe(
      true,
    );
    expect(
      consentAllows([clinical], "Marketing publication", withdrawnAt),
    ).toBe(false);
    expect(
      consentAllows([clinical], "Patient portal sharing", withdrawnAt),
    ).toBe(false);
  });

  it("withdrawal blocks new sharing", () => {
    const sharing = createConsentRecord({
      purpose: "Patient portal sharing",
      grantedBy: staffId,
      grantedAt,
    });
    const withdrawn = withdraw(sharing, withdrawnAt);

    expect(withdrawn.revokedAt).toBe(withdrawnAt.toISOString());
    expect(sharing.revokedAt).toBeNull();
    expect(withdrawn).not.toBe(sharing);
    expect(
      consentAllows([sharing], "Patient portal sharing", afterward),
    ).toBe(true);
    expect(
      consentAllows([withdrawn], "Patient portal sharing", afterward),
    ).toBe(false);
    expect(
      consentAllows([withdrawn], "Patient portal sharing", withdrawnAt),
    ).toBe(false);
  });

  it("clinical consent remains after marketing is withdrawn", () => {
    const clinical = createConsentRecord({
      purpose: "Clinical photography",
      grantedBy: staffId,
      grantedAt,
    });
    const marketing = withdraw(
      createConsentRecord({
        purpose: "Marketing publication",
        grantedBy: staffId,
        grantedAt,
      }),
      withdrawnAt,
    );

    expect(clinical.revokedAt).toBeNull();
    expect(marketing.revokedAt).toBe(withdrawnAt.toISOString());
    expect(
      consentAllows([clinical, marketing], "Clinical photography", afterward),
    ).toBe(true);
    expect(
      consentAllows([clinical, marketing], "Marketing publication", afterward),
    ).toBe(false);
  });

  it("rejects an unknown purpose with a plain message", () => {
    const parsed = consentDecisionSchema.safeParse({
      patientId: "44444444-4444-4444-8444-444444444444",
      purpose: "Everything",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("Choose a consent purpose.");
    }
  });
});
