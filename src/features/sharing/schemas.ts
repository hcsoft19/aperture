import { z } from "zod";

import { isUuid } from "@/lib/ids";

export const invitationSchema = z.object({
  patientId: z.string().refine(isUuid, "This chart is not available."),
  email: z.string().trim().email("Enter the email the patient will use to sign in.").max(320),
});

export const releaseSchema = z.object({
  sessionId: z.string().refine(isUuid, "This session is not available."),
  released: z.boolean(),
});

export const shareSchema = z.object({
  comparisonId: z.string().refine(isUuid, "This comparison is not available."),
  shared: z.boolean(),
});
