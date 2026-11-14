import { z } from "zod";

export const PROTOCOL_CODES = [
  "FACE_STANDARD",
  "DENTAL_STANDARD",
  "BODY_STANDARD",
] as const;

export type ProtocolCode = (typeof PROTOCOL_CODES)[number];

const PROTOCOL_LABELS: Record<ProtocolCode, string> = {
  FACE_STANDARD: "Standard facial views",
  DENTAL_STANDARD: "Dental documentation",
  BODY_STANDARD: "Body documentation",
};

export const protocolOptions = PROTOCOL_CODES.map((value) => ({
  value,
  label: PROTOCOL_LABELS[value],
}));

export function protocolLabel(code: string) {
  if ((PROTOCOL_CODES as readonly string[]).includes(code)) {
    return PROTOCOL_LABELS[code as ProtocolCode];
  }

  return code;
}

const followUpDaysSchema = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined || value === null) {
      return null;
    }

    const days =
      typeof value === "number"
        ? value
        : /^\d+$/.test(value.trim())
          ? Number(value.trim())
          : Number.NaN;

    if (typeof value === "string" && value.trim() === "") {
      return null;
    }

    if (!Number.isInteger(days)) {
      ctx.addIssue("Enter a whole number of days.");
      return z.NEVER;
    }

    if (days < 1 || days > 3650) {
      ctx.addIssue("Enter between 1 and 3650 days.");
      return z.NEVER;
    }

    return days;
  });

export const treatmentTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a template name.")
    .max(120, "Use 120 characters or fewer."),
  category: z
    .string()
    .trim()
    .min(1, "Enter a category.")
    .max(80, "Use 80 characters or fewer."),
  bodyArea: z
    .string()
    .trim()
    .min(1, "Enter a body area.")
    .max(80, "Use 80 characters or fewer."),
  protocolCode: z
    .enum(PROTOCOL_CODES, { error: "Choose a photography protocol." })
    .default("FACE_STANDARD"),
  followUpDays: followUpDaysSchema,
});

export type TreatmentTemplateInput = z.input<typeof treatmentTemplateSchema>;
export type TreatmentTemplateValues = z.output<typeof treatmentTemplateSchema>;

export type TreatmentTemplate = {
  id: string;
  organizationId: string;
  name: string;
  category: string;
  bodyArea: string;
  protocolCode: string;
  followUpDays: number | null;
  archivedAt: string | null;
};

export type TreatmentDraft = {
  patientId: string;
  organizationId: string;
  name: string;
  category: string;
  bodyArea: string;
  protocolCode: string;
  followUpDays: number | null;
  status: "planned";
};

export function templatesForOrganization<T extends { organizationId: string }>(
  templates: readonly T[],
  organizationId: string,
): T[] {
  return templates.filter((template) => template.organizationId === organizationId);
}

/**
 * Builds a new treatment draft from a clinic template.
 * The result has no treatment id, so it cannot update an existing treatment row.
 */
export function applyTemplate(
  template: {
    organizationId: string;
    name: string;
    category: string;
    bodyArea: string;
    protocolCode: string;
    followUpDays: number | null;
  },
  patientId: string,
): TreatmentDraft {
  return {
    patientId,
    organizationId: template.organizationId,
    name: template.name,
    category: template.category,
    bodyArea: template.bodyArea,
    protocolCode: template.protocolCode,
    followUpDays: template.followUpDays,
    status: "planned",
  };
}
