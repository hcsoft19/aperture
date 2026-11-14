import { z } from "zod";

/** Shown on a branded report when the comparison uses a presentation edit. */
export const PRESENTATION_DISCLOSURE = "Presentation edit";

const reportInputSchema = z.object({
  clinicName: z.string().trim().min(1).max(120),
  angleLabel: z.string().trim().min(1).max(120),
  treatmentDate: z.iso.date(),
  approved: z.boolean(),
  revoked: z.boolean(),
  presentationEdited: z.boolean(),
  marketingUse: z.boolean(),
  marketingConsent: z.boolean(),
});

export type ReportInput = z.infer<typeof reportInputSchema>;

export type ClinicReport = {
  clinicName: string;
  angleLabel: string;
  treatmentDate: string;
  marketingUse: boolean;
  disclosure: typeof PRESENTATION_DISCLOSURE | null;
};

export type ReportRefusal = "unapproved" | "revoked" | "marketing_consent" | "invalid";

export type ReportResult =
  | { ok: true; report: ClinicReport }
  | { ok: false; reason: ReportRefusal };

export const reportRefusalMessage: Record<ReportRefusal, string> = {
  unapproved: "A report uses approved comparisons only.",
  revoked: "This comparison was revoked, so it cannot be reported.",
  marketing_consent: "Marketing use needs marketing consent.",
  invalid: "This report could not be prepared.",
};

/**
 * Synthetic preview used by the staff page. It is not a patient record.
 * Marketing stays off so the sample does not imply public permission.
 */
export const sampleReportInput = {
  clinicName: "Northshore Aesthetics",
  angleLabel: "Front",
  treatmentDate: "2026-03-12",
  approved: true,
  revoked: false,
  presentationEdited: true,
  marketingUse: false,
  marketingConsent: false,
} as const satisfies ReportInput;

export function formatReportDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Builds branded-report metadata for one comparison.
 * The result never carries an original storage path.
 */
export function buildReport(input: unknown): ReportResult {
  const parsed = reportInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  const value = parsed.data;
  if (!value.approved) {
    return { ok: false, reason: "unapproved" };
  }

  if (value.revoked) {
    return { ok: false, reason: "revoked" };
  }

  if (value.marketingUse && !value.marketingConsent) {
    return { ok: false, reason: "marketing_consent" };
  }

  return {
    ok: true,
    report: {
      clinicName: value.clinicName,
      angleLabel: value.angleLabel,
      treatmentDate: value.treatmentDate,
      marketingUse: value.marketingUse,
      disclosure: value.presentationEdited ? PRESENTATION_DISCLOSURE : null,
    },
  };
}
