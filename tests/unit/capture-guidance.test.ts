import { describe, expect, it } from "vitest";

import { assessCapture, exposureScore, luminanceFromRgba, sharpnessScore, stabilityScore } from "@/features/capture/guidance/analyze";
import { captureAssessmentSchema, parseCaptureAssessment, smartCaptureEnabled } from "@/features/capture/guidance/schema";

const readyFace = { centerX: 0.5, centerY: 0.45, width: 0.4, height: 0.5 };

describe("capture guidance", () => {
  it("keeps a centered front photograph ready", () => {
    const assessment = assessCapture({
      angleCode: "front",
      detector: "face-detector",
      face: readyFace,
      sharpness: 0.2,
      exposure: 0.5,
      stability: 0.95,
      baseline: null,
    });
    expect(assessment.status).toBe("good");
    expect(assessment.instruction).toBe("The framing looks ready.");
    expect(parseCaptureAssessment(JSON.parse(JSON.stringify(assessment)))).toEqual(assessment);
  });

  it("asks for a retake when the face is missing or the frame is soft", () => {
    const missing = assessCapture({
      angleCode: "front",
      detector: "face-detector",
      face: null,
      sharpness: 0.2,
      exposure: 0.5,
      stability: 0.95,
      baseline: null,
    });
    const soft = assessCapture({
      angleCode: "left_45",
      detector: "face-detector",
      face: { ...readyFace, centerX: 0.64 },
      sharpness: 0.01,
      exposure: 0.5,
      stability: 0.95,
      baseline: null,
    });
    expect(missing.status).toBe("poor");
    expect(missing.warnings).toContain("face_missing");
    expect(soft.status).toBe("poor");
    expect(soft.warnings).toContain("blur");
  });

  it("warns when automatic framing is unavailable and still returns pixel checks", () => {
    const assessment = assessCapture({
      angleCode: "front",
      detector: "none",
      face: null,
      sharpness: 0.2,
      exposure: 0.05,
      stability: null,
      baseline: null,
    });
    expect(assessment.status).toBe("poor");
    expect(assessment.warnings).toEqual(["detector_unavailable", "exposure_dark"]);
    expect(assessment.metrics.pitch).toBeNull();
  });

  it("rejects stored landmarks or embeddings", () => {
    const parsed = captureAssessmentSchema.safeParse({
      version: 1,
      detector: "none",
      detectorVersion: "none",
      status: "warning",
      warnings: ["detector_unavailable"],
      metrics: {
        faceCenterX: null,
        faceCenterY: null,
        faceWidth: null,
        faceHeight: null,
        yaw: null,
        pitch: null,
        roll: null,
        sharpness: null,
        exposure: null,
        stability: null,
        landmarks: [[0, 0]],
      },
      instruction: "Use the guide.",
    });
    expect(parsed.success).toBe(false);
  });

  it("turns guidance off only when the flag says off", () => {
    expect(smartCaptureEnabled(undefined)).toBe(true);
    expect(smartCaptureEnabled("on")).toBe(true);
    expect(smartCaptureEnabled("off")).toBe(false);
  });

  it("scores blur, exposure, and movement from pixels", () => {
    const flat = luminanceFromRgba(new Uint8ClampedArray([10, 10, 10, 255, 10, 10, 10, 255]));
    const edges = new Uint8Array([0, 255, 0, 255]);
    expect(sharpnessScore(flat, 2)).toBe(0);
    expect(exposureScore(flat)).toBeLessThan(0.1);
    expect(sharpnessScore(edges, 2)).toBeGreaterThan(0.9);
    expect(stabilityScore(edges, edges)).toBe(1);
    expect(stabilityScore(edges, new Uint8Array([255, 0, 255, 0]))).toBeLessThan(0.1);
  });
});
