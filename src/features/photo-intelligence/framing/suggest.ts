export const FRAMING_VERSION = "framing-heuristic-1";

export type FaceBox = {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
} | null;

export type FramingCrop = {
  aspect: "free";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FramingSuggestion =
  | { ok: false; reason: "no_face" }
  | {
      ok: true;
      version: typeof FRAMING_VERSION;
      confidence: number;
      crop: FramingCrop;
    };

const TARGET_FACE_WIDTH = 0.45;
const CONFIDENT_MIN_WIDTH = 0.22;
const CONFIDENT_MAX_WIDTH = 0.62;

export function suggestFraming(face: FaceBox): FramingSuggestion {
  if (face === null || !positiveFinite(face.width) || !positiveFinite(face.height)) {
    return { ok: false, reason: "no_face" };
  }

  const width = Math.min(1, face.width / TARGET_FACE_WIDTH);
  const sidePadding = Math.max(0, (width - face.width) / 2);
  const height = Math.min(1, face.height + sidePadding * 2);
  const x = placeOrigin(face.centerX, width);
  const y = placeOrigin(face.centerY, height);
  const confidence =
    face.width >= CONFIDENT_MIN_WIDTH && face.width <= CONFIDENT_MAX_WIDTH ? 0.8 : 0.45;

  return {
    ok: true,
    version: FRAMING_VERSION,
    confidence,
    crop: { aspect: "free", x, y, width, height },
  };
}

function positiveFinite(value: number) {
  return Number.isFinite(value) && value > 0;
}

function placeOrigin(center: number, length: number) {
  const limit = 1 - length;
  let origin = Number.isFinite(center) ? center - length / 2 : limit / 2;
  if (origin < 0) origin = 0;
  if (origin > limit) origin = limit;
  return origin;
}
