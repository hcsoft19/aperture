import { z } from "zod";

import { isUuid } from "@/lib/ids";

export const captureMimeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);

export const startCaptureSchema = z.object({
  treatmentId: z.string().refine(isUuid, "Choose a treatment."),
  sessionType: z.enum(["baseline", "follow_up"]),
  confirmConsent: z.boolean(),
});

export const preparePhotoSchema = z.object({
  sessionId: z.string().refine(isUuid, "This session is not available."),
  angleId: z.string().refine(isUuid, "This angle is not available."),
  source: z.enum(["camera", "gallery"]),
  mimeType: captureMimeSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fileSizeBytes: z.number().int().positive().max(10485760, "Use a photograph under 10 MB."),
  sha256: z.string().regex(/^[a-f0-9]{64}$/, "The photograph could not be checked."),
  cameraFacing: z.enum(["user", "environment"]).nullable(),
  overlayOpacity: z.number().min(0.1).max(0.9).nullable(),
  referencePhotoId: z.string().refine(isUuid, "The reference photograph is not available.").nullable(),
});

export const finishSessionSchema = z.object({
  sessionId: z.string().refine(isUuid, "This session is not available."),
  missingReason: z.string().trim().max(500, "Use 500 characters or fewer."),
});

export type StartCaptureValues = z.infer<typeof startCaptureSchema>;
export type PreparePhotoValues = z.infer<typeof preparePhotoSchema>;
