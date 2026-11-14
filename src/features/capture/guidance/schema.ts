import { z } from "zod";

export const guidanceStatuses = ["good", "warning", "poor", "unavailable"] as const;

export const guidanceWarnings = [
  "detector_unavailable",
  "face_missing",
  "face_off_center",
  "face_too_small",
  "face_too_large",
  "pose_mismatch",
  "blur",
  "exposure_dark",
  "exposure_bright",
  "unstable",
  "baseline_mismatch",
] as const;

export const captureAssessmentSchema = z
  .object({
    version: z.literal(1),
    detector: z.enum(["face-detector", "none"]),
    detectorVersion: z.string().trim().min(1).max(40),
    status: z.enum(guidanceStatuses),
    warnings: z.array(z.enum(guidanceWarnings)).max(12),
    metrics: z
      .object({
        faceCenterX: z.number().min(0).max(1).nullable(),
        faceCenterY: z.number().min(0).max(1).nullable(),
        faceWidth: z.number().min(0).max(1).nullable(),
        faceHeight: z.number().min(0).max(1).nullable(),
        yaw: z.number().min(-90).max(90).nullable(),
        pitch: z.number().min(-90).max(90).nullable(),
        roll: z.number().min(-90).max(90).nullable(),
        sharpness: z.number().min(0).max(1).nullable(),
        exposure: z.number().min(0).max(1).nullable(),
        stability: z.number().min(0).max(1).nullable(),
      })
      .strict(),
    instruction: z.string().trim().min(1).max(160),
  })
  .strict();

export const captureSettingsSchema = z
  .object({
    guidanceEnabled: z.boolean(),
  })
  .strict();

export const overrideReasonSchema = z.string().trim().min(3).max(500);

export type GuidanceStatus = (typeof guidanceStatuses)[number];
export type GuidanceWarning = (typeof guidanceWarnings)[number];
export type CaptureAssessment = z.infer<typeof captureAssessmentSchema>;

export function parseCaptureAssessment(value: unknown) {
  const parsed = captureAssessmentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function smartCaptureEnabled(flag: string | null | undefined) {
  return flag !== "off";
}
