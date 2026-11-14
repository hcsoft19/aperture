import { describe, expect, it } from "vitest";

import {
  applyTemplate,
  templatesForOrganization,
  treatmentTemplateSchema,
  type TreatmentTemplate,
} from "@/features/treatment-templates/model";

const studioId = "33333333-3333-4333-8333-333333333333";
const otherClinicId = "55555555-5555-4555-8555-555555555555";
const patientId = "44444444-4444-4444-8444-444444444444";

const validInput = {
  name: " Lip filler ",
  category: " Injectables ",
  bodyArea: " Lips ",
};

function template(overrides: Partial<TreatmentTemplate> = {}): TreatmentTemplate {
  return {
    id: "10000000-0000-4000-8000-000000000010",
    organizationId: studioId,
    name: "Lip filler",
    category: "Injectables",
    bodyArea: "Lips",
    protocolCode: "FACE_STANDARD",
    followUpDays: 14,
    archivedAt: null,
    ...overrides,
  };
}

describe("treatment template validation", () => {
  it("defaults the protocol to FACE_STANDARD and follow-up to blank", () => {
    const parsed = treatmentTemplateSchema.safeParse(validInput);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data).toEqual({
      name: "Lip filler",
      category: "Injectables",
      bodyArea: "Lips",
      protocolCode: "FACE_STANDARD",
      followUpDays: null,
    });
    expect(parsed.data).not.toHaveProperty("organizationId");
  });

  it("keeps an explicit protocol and a follow-up inside 1 to 3650 days", () => {
    expect(
      treatmentTemplateSchema.safeParse({
        ...validInput,
        protocolCode: "BODY_STANDARD",
        followUpDays: " 14 ",
      }).data,
    ).toMatchObject({ protocolCode: "BODY_STANDARD", followUpDays: 14 });

    expect(
      treatmentTemplateSchema.safeParse({ ...validInput, followUpDays: 1 }).success,
    ).toBe(true);
    expect(
      treatmentTemplateSchema.safeParse({ ...validInput, followUpDays: 3650 }).success,
    ).toBe(true);
    expect(
      treatmentTemplateSchema.safeParse({ ...validInput, followUpDays: "" }).data
        ?.followUpDays,
    ).toBeNull();
  });

  it("rejects an empty name, an unknown protocol, and a follow-up outside the range", () => {
    expect(treatmentTemplateSchema.safeParse({ ...validInput, name: " " }).success).toBe(
      false,
    );
    expect(
      treatmentTemplateSchema.safeParse({
        ...validInput,
        protocolCode: "CUSTOM",
      }).success,
    ).toBe(false);

    for (const followUpDays of [0, 3651, -1, 1.5, "0", "3651", "14 days"]) {
      const parsed = treatmentTemplateSchema.safeParse({ ...validInput, followUpDays });
      expect(parsed.success).toBe(false);
    }

    const tooSoon = treatmentTemplateSchema.safeParse({ ...validInput, followUpDays: 0 });
    expect(tooSoon.success).toBe(false);
    if (!tooSoon.success) {
      expect(tooSoon.error.issues[0]?.message).toBe("Enter between 1 and 3650 days.");
    }
  });
});

describe("treatment template organization scope", () => {
  it("returns only the requested clinic and leaves the source list intact", () => {
    const current = template({ name: "Current" });
    const archived = template({
      id: "10000000-0000-4000-8000-000000000011",
      name: "Old filler",
      archivedAt: "2026-01-01T00:00:00.000Z",
    });
    const foreign = template({
      id: "10000000-0000-4000-8000-000000000012",
      organizationId: otherClinicId,
      name: "Isolated plan",
    });
    const all = [archived, current, foreign];
    const snapshot = structuredClone(all);

    const scoped = templatesForOrganization(all, studioId);

    expect(scoped.map((item) => item.name)).toEqual(["Old filler", "Current"]);
    expect(scoped).not.toBe(all);
    expect(all).toEqual(snapshot);
    expect(templatesForOrganization(all, otherClinicId).map((item) => item.id)).toEqual([
      foreign.id,
    ]);
  });
});

describe("applyTemplate", () => {
  it("returns a new draft and does not mutate the template", () => {
    const source = template();
    const snapshot = structuredClone(source);

    const draft = applyTemplate(source, patientId);
    draft.name = "Changed draft";
    draft.followUpDays = 1;
    draft.organizationId = otherClinicId;

    expect(source).toEqual(snapshot);
    expect(draft).not.toBe(source);
    expect(draft).not.toHaveProperty("id");
    expect(draft).not.toHaveProperty("archivedAt");
    expect(applyTemplate(source, patientId)).toEqual({
      patientId,
      organizationId: studioId,
      name: "Lip filler",
      category: "Injectables",
      bodyArea: "Lips",
      protocolCode: "FACE_STANDARD",
      followUpDays: 14,
      status: "planned",
    });
  });
});
