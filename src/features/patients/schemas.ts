import { z } from "zod";

const treatmentStatuses = [
  "planned",
  "active",
  "completed",
  "cancelled",
] as const;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export const patientSchema = z.object({
  gender: z
    .enum([
      "",
      "female",
      "male",
      "non_binary",
      "self_described",
      "prefer_not_to_say",
    ])
    .optional(),
  firstName: z
    .string()
    .trim()
    .min(1, "Enter a first name.")
    .max(80, "Use 80 characters or fewer."),
  lastName: z
    .string()
    .trim()
    .min(1, "Enter a last name.")
    .max(80, "Use 80 characters or fewer."),
  dateOfBirth: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Enter a valid date.",
    )
    .refine(
      (value) => value === "" || value >= "1900-01-01",
      "Enter a date in 1900 or later.",
    )
    .refine(
      (value) => value === "" || value <= todayUtc(),
      "Date of birth cannot be in the future.",
    ),
  contactEmail: z
    .string()
    .trim()
    .max(320, "Use 320 characters or fewer.")
    .refine(
      (value) => value === "" || z.email().safeParse(value).success,
      "Enter a valid email address.",
    ),
  phone: z
    .string()
    .trim()
    .max(40, "Use 40 characters or fewer.")
    .refine(
      (value) => value === "" || /^[0-9+().\-\s]+$/.test(value),
      "Use digits and phone punctuation only.",
    ),
});

export const treatmentSchema = z.object({
  procedureType: z.string().trim().max(80).optional(),
  productName: z.string().trim().max(120).optional(),
  protocolCode: z
    .enum(["FACE_STANDARD", "DENTAL_STANDARD", "BODY_STANDARD"])
    .optional(),
  name: z
    .string()
    .trim()
    .min(1, "Enter a treatment name.")
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
  description: z.string().trim().max(2000, "Use 2000 characters or fewer."),
  startDate: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Enter a valid date.",
    ),
  status: z.enum(treatmentStatuses),
});

export type PatientValues = z.infer<typeof patientSchema>;
export type TreatmentValues = z.infer<typeof treatmentSchema>;
export type TreatmentStatus = (typeof treatmentStatuses)[number];
