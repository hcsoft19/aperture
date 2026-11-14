/**
 * On-device presentation estimate of how much of a frame differs from its border.
 * This is not clinical evidence and does not alter or generate a photograph.
 */

export const SEGMENTATION_VERSION = "segmentation-heuristic-1";

const MIN_EDGE = 8;
const MIN_COVERAGE = 0.08;
const MAX_COVERAGE = 0.92;
const BACKGROUND_DISTANCE = 36;

export type SegmentationEstimate =
  | {
      ok: false;
      reason: "too_small" | "poor_separation";
    }
  | {
      ok: true;
      version: typeof SEGMENTATION_VERSION;
      coverage: number;
    };

type Rgb = {
  r: number;
  g: number;
  b: number;
};

export function segmentationEnabled(flag: string | null | undefined) {
  return flag === "on";
}

export function estimateBackground({
  width,
  height,
  rgba,
}: {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}): SegmentationEstimate {
  if (width < MIN_EDGE || height < MIN_EDGE || rgba.length < width * height * 4) {
    return { ok: false, reason: "too_small" };
  }

  const average = borderAverage(width, height, rgba);
  const total = width * height;
  let foreground = 0;

  for (let index = 0; index < total; index += 1) {
    const offset = index * 4;
    const distance = rgbDistance(
      channel(rgba, offset),
      channel(rgba, offset + 1),
      channel(rgba, offset + 2),
      average,
    );
    if (distance >= BACKGROUND_DISTANCE) {
      foreground += 1;
    }
  }

  const coverage = foreground / total;
  if (coverage < MIN_COVERAGE || coverage > MAX_COVERAGE) {
    return { ok: false, reason: "poor_separation" };
  }

  return { ok: true, version: SEGMENTATION_VERSION, coverage };
}

function borderAverage(width: number, height: number, rgba: Uint8ClampedArray): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  const add = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    r += channel(rgba, offset);
    g += channel(rgba, offset + 1);
    b += channel(rgba, offset + 2);
    count += 1;
  };

  for (let x = 0; x < width; x += 1) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    add(0, y);
    add(width - 1, y);
  }

  return { r: r / count, g: g / count, b: b / count };
}

function rgbDistance(r: number, g: number, b: number, average: Rgb) {
  return Math.hypot(r - average.r, g - average.g, b - average.b);
}

function channel(rgba: Uint8ClampedArray, offset: number) {
  return rgba[offset] ?? 0;
}
