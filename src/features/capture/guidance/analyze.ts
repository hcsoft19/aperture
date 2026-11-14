import type { CaptureAssessment, GuidanceStatus, GuidanceWarning } from "@/features/capture/guidance/schema";

export const FACE_DETECTOR_VERSION = "face-detector-1";

export type FaceSample = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

export type AssessCaptureInput = {
  angleCode: string;
  detector: "face-detector" | "none";
  face: FaceSample | null;
  sharpness: number | null;
  exposure: number | null;
  stability: number | null;
  baseline: Pick<FaceSample, "centerX" | "centerY" | "width"> | null;
};

const ANGLE_TARGET: Record<string, { x: number; tolerance: number }> = {
  front: { x: 0.5, tolerance: 0.1 },
  left_45: { x: 0.64, tolerance: 0.12 },
  right_45: { x: 0.36, tolerance: 0.12 },
  left_90: { x: 0.74, tolerance: 0.14 },
  right_90: { x: 0.26, tolerance: 0.14 },
};

export function luminanceFromRgba(rgba: Uint8ClampedArray) {
  const pixels = new Uint8Array(rgba.length / 4);
  for (let index = 0; index < pixels.length; index += 1) {
    const offset = index * 4;
    pixels[index] = Math.round(rgba[offset] * 0.299 + rgba[offset + 1] * 0.587 + rgba[offset + 2] * 0.114);
  }
  return pixels;
}

export function sharpnessScore(pixels: Uint8Array, width: number) {
  if (width < 2 || pixels.length < width) {
    return null;
  }
  let total = 0;
  let count = 0;
  for (let index = 0; index < pixels.length; index += 2) {
    if (index % width === width - 1) {
      continue;
    }
    const next = pixels[index + 1];
    if (next === undefined) {
      continue;
    }
    total += Math.abs(pixels[index] - next);
    count += 1;
  }
  return count === 0 ? null : round(total / count / 255);
}

export function exposureScore(pixels: Uint8Array) {
  if (pixels.length === 0) {
    return null;
  }
  let total = 0;
  for (const value of pixels) {
    total += value;
  }
  return round(total / pixels.length / 255);
}

export function stabilityScore(current: Uint8Array, previous: Uint8Array | null) {
  if (!previous || previous.length !== current.length || current.length === 0) {
    return null;
  }
  let total = 0;
  const step = Math.max(1, Math.floor(current.length / 4000));
  let count = 0;
  for (let index = 0; index < current.length; index += step) {
    total += Math.abs(current[index] - previous[index]);
    count += 1;
  }
  return count === 0 ? null : round(1 - total / count / 255);
}

export function assessCapture(input: AssessCaptureInput): CaptureAssessment {
  const target = ANGLE_TARGET[input.angleCode] ?? ANGLE_TARGET.front;
  const warnings: GuidanceWarning[] = [];
  const face = input.face;

  if (input.detector === "none") {
    warnings.push("detector_unavailable");
  } else if (!face) {
    warnings.push("face_missing");
  } else {
    if (face.width < 0.22) {
      warnings.push("face_too_small");
    } else if (face.width > 0.62) {
      warnings.push("face_too_large");
    }
    if (Math.abs(face.centerX - target.x) > target.tolerance) {
      warnings.push(input.angleCode === "front" ? "face_off_center" : "pose_mismatch");
    }
  }

  if (input.sharpness !== null) {
    if (input.sharpness < 0.03) {
      warnings.push("blur");
    }
  }
  if (input.exposure !== null) {
    if (input.exposure < 0.18) {
      warnings.push("exposure_dark");
    } else if (input.exposure > 0.88) {
      warnings.push("exposure_bright");
    }
  }
  if (input.stability !== null && input.stability < 0.72) {
    warnings.push("unstable");
  }
  if (face && input.baseline) {
    const distance = Math.hypot(face.centerX - input.baseline.centerX, face.centerY - input.baseline.centerY);
    const ratio = input.baseline.width === 0 ? 1 : face.width / input.baseline.width;
    if (distance > 0.12 || ratio < 0.7 || ratio > 1.35) {
      warnings.push("baseline_mismatch");
    }
  }

  const yaw = face ? clamp((target.x - face.centerX) * 140, -90, 90) : null;
  const status = overallStatus(warnings);

  return {
    version: 1,
    detector: input.detector,
    detectorVersion: input.detector === "none" ? "none" : FACE_DETECTOR_VERSION,
    status,
    warnings,
    metrics: {
      faceCenterX: face ? round(face.centerX) : null,
      faceCenterY: face ? round(face.centerY) : null,
      faceWidth: face ? round(face.width) : null,
      faceHeight: face ? round(face.height) : null,
      yaw,
      pitch: null,
      roll: null,
      sharpness: input.sharpness,
      exposure: input.exposure,
      stability: input.stability,
    },
    instruction: instructionFor(warnings),
  };
}

const POOR_WARNINGS = new Set<GuidanceWarning>([
  "face_missing",
  "face_too_small",
  "face_too_large",
  "blur",
  "exposure_dark",
  "exposure_bright",
  "unstable",
]);

function overallStatus(warnings: GuidanceWarning[]): GuidanceStatus {
  if (warnings.some((warning) => POOR_WARNINGS.has(warning))) {
    return "poor";
  }
  if (warnings.length > 0) {
    return "warning";
  }
  return "good";
}

function instructionFor(warnings: GuidanceWarning[]) {
  if (warnings.includes("face_missing")) {
    return "Move the face into the guide.";
  }
  if (warnings.includes("face_too_small")) {
    return "Move closer so the face fills the guide.";
  }
  if (warnings.includes("face_too_large")) {
    return "Move back so the whole face fits the guide.";
  }
  if (warnings.includes("pose_mismatch")) {
    return "Turn to match this angle, then center the face in the guide.";
  }
  if (warnings.includes("face_off_center")) {
    return "Center the face in the guide.";
  }
  if (warnings.includes("blur")) {
    return "Hold still. The image looks soft.";
  }
  if (warnings.includes("exposure_dark")) {
    return "Add light. The image looks dark.";
  }
  if (warnings.includes("exposure_bright")) {
    return "Reduce the light. The image looks bright.";
  }
  if (warnings.includes("unstable")) {
    return "Hold the camera steady.";
  }
  if (warnings.includes("baseline_mismatch")) {
    return "Match the baseline framing.";
  }
  if (warnings.includes("detector_unavailable")) {
    return "Automatic framing is unavailable. Use the guide and the checklist.";
  }
  return "The framing looks ready.";
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, round(value)));
}
