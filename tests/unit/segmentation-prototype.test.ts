import { describe, expect, it } from "vitest";

import {
  SEGMENTATION_VERSION,
  estimateBackground,
  segmentationEnabled,
} from "@/features/photo-intelligence/segmentation/estimate";

const HIDDEN_FIELDS = ["rgba", "pixels", "width", "height"] as const;

describe("segmentation prototype", () => {
  it("enables the estimate only when the flag is on", () => {
    expect(segmentationEnabled("on")).toBe(true);
    expect(segmentationEnabled("off")).toBe(false);
    expect(segmentationEnabled(null)).toBe(false);
    expect(segmentationEnabled(undefined)).toBe(false);
  });

  it("rejects an image smaller than 8 pixels on either edge", () => {
    const narrow = estimateBackground({
      width: 7,
      height: 16,
      rgba: new Uint8ClampedArray(7 * 16 * 4),
    });
    const short = estimateBackground({
      width: 16,
      height: 7,
      rgba: new Uint8ClampedArray(16 * 7 * 4),
    });

    expect(narrow).toEqual({ ok: false, reason: "too_small" });
    expect(short).toEqual({ ok: false, reason: "too_small" });
    expectHidden(narrow);
    expectHidden(short);
  });

  it("rejects a buffer that is shorter than the stated frame", () => {
    const result = estimateBackground({
      width: 8,
      height: 8,
      rgba: new Uint8ClampedArray(8),
    });

    expect(result).toEqual({ ok: false, reason: "too_small" });
    expectHidden(result);
  });

  it("rejects a flat gray buffer because the subject does not separate", () => {
    const width = 8;
    const height = 8;
    const result = estimateBackground({
      width,
      height,
      rgba: solid(width, height, [128, 128, 128]),
    });

    expect(result).toEqual({ ok: false, reason: "poor_separation" });
    expectHidden(result);
  });

  it("estimates coverage for a dark border and a bright center", () => {
    const width = 16;
    const height = 16;
    const rgba = solid(width, height, [12, 12, 12]);
    paint(rgba, width, 4, 4, 12, 12, [240, 240, 240]);

    const result = estimateBackground({ width, height, rgba });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.version).toBe(SEGMENTATION_VERSION);
      expect(result.coverage).toBeGreaterThan(0);
      expect(result.coverage).toBeLessThan(1);
    }
    expectHidden(result);
  });
});

function expectHidden(result: object) {
  for (const field of HIDDEN_FIELDS) {
    expect(result).not.toHaveProperty(field);
  }
}

function solid(width: number, height: number, rgb: [number, number, number]) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  paint(rgba, width, 0, 0, width, height, rgb);
  return rgba;
}

function paint(
  rgba: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: [number, number, number],
) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = (y * width + x) * 4;
      rgba[offset] = rgb[0];
      rgba[offset + 1] = rgb[1];
      rgba[offset + 2] = rgb[2];
      rgba[offset + 3] = 255;
    }
  }
}
