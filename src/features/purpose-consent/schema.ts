import { z } from "zod";

import { CONSENT_PURPOSES } from "@/features/purpose-consent/purposes";
import { isUuid } from "@/lib/ids";

export const consentDecisionSchema = z.object({
  patientId: z.string().refine(isUuid, "This chart is not available."),
  purpose: z.enum(CONSENT_PURPOSES, "Choose a consent purpose."),
});

export type ConsentActionResult =
  | { status: "error"; message: string }
  | { status: "success"; message: string };
