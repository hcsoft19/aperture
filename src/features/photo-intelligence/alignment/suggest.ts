export const ALIGNMENT_VERSION = "alignment-heuristic-1";

export type Geometry = {
  centerX: number;
  centerY: number;
  width: number;
  roll: number | null;
};

export type AlignmentValues = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
};

export type AlignmentSuggestionResult =
  | { ok: false; reason: "different_angle" | "missing_geometry" }
  | ({
      ok: true;
      version: typeof ALIGNMENT_VERSION;
      confidence: number;
    } & AlignmentValues);

export function suggestAlignment(input: {
  sameAngle: boolean;
  baseline: Geometry | null;
  followUp: Geometry | null;
}): AlignmentSuggestionResult {
  if (!input.sameAngle) {
    return { ok: false, reason: "different_angle" };
  }

  const { baseline, followUp } = input;
  if (!usableGeometry(baseline) || !usableGeometry(followUp)) {
    return { ok: false, reason: "missing_geometry" };
  }

  const rawScale = baseline.width / followUp.width;
  const rawRotation = (baseline.roll ?? 0) - (followUp.roll ?? 0);
  const rollsKnown = typeof baseline.roll === "number" && typeof followUp.roll === "number";
  const confidence =
    rollsKnown && Math.abs(rawRotation) <= 15 && rawScale >= 0.8 && rawScale <= 1.25 ? 0.75 : 0.4;

  return {
    ok: true,
    version: ALIGNMENT_VERSION,
    confidence,
    x: clamp((followUp.centerX - baseline.centerX) * 100, -50, 50),
    y: clamp((followUp.centerY - baseline.centerY) * 100, -50, 50),
    rotation: clamp(rawRotation, -15, 15),
    scale: clamp(rawScale, 0.5, 2),
  };
}

function usableGeometry(geometry: Geometry | null): geometry is Geometry {
  return (
    geometry !== null &&
    Number.isFinite(geometry.centerX) &&
    Number.isFinite(geometry.centerY) &&
    Number.isFinite(geometry.width) &&
    geometry.width > 0 &&
    (geometry.roll === null || Number.isFinite(geometry.roll))
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
