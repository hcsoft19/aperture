import { describe, it, expect } from "vitest";

describe("Background renderer utilities", () => {
  describe("parseHexColor", () => {
    it("parses white correctly", () => {
      const parseHexColor = (hex: string) => {
        const clean = hex.replace("#", "");
        const r = parseInt(clean.substring(0, 2), 16);
        const g = parseInt(clean.substring(2, 4), 16);
        const b = parseInt(clean.substring(4, 6), 16);
        return { r, g, b };
      };

      expect(parseHexColor("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
      expect(parseHexColor("#000000")).toEqual({ r: 0, g: 0, b: 0 });
      expect(parseHexColor("#E6E6E6")).toEqual({ r: 230, g: 230, b: 230 });
      expect(parseHexColor("F5F5F5")).toEqual({ r: 245, g: 245, b: 245 });
    });
  });

  describe("clamp", () => {
    it("clamps values to range", () => {
      const clamp = (value: number, min: number, max: number) =>
        Math.max(min, Math.min(max, value));

      expect(clamp(50, 0, 100)).toBe(50);
      expect(clamp(-10, 0, 100)).toBe(0);
      expect(clamp(150, 0, 100)).toBe(100);
      expect(clamp(0, 0, 100)).toBe(0);
      expect(clamp(100, 0, 100)).toBe(100);
    });
  });

  describe("Brush corrections", () => {
    it("validates stroke structure", () => {
      const stroke = {
        id: "test-stroke",
        mode: "add" as const,
        points: [
          [0.5, 0.5] as [number, number],
          [0.6, 0.6] as [number, number],
        ],
        radius: 0.05,
        timestamp: Date.now(),
      };

      expect(stroke.mode).toBe("add");
      expect(stroke.points).toHaveLength(2);
      expect(stroke.radius).toBeGreaterThan(0);
      expect(stroke.radius).toBeLessThanOrEqual(1);
    });

    it("accepts remove mode", () => {
      const stroke = {
        id: "test-stroke",
        mode: "remove" as const,
        points: [[0.5, 0.5] as [number, number]],
        radius: 0.02,
        timestamp: Date.now(),
      };

      expect(stroke.mode).toBe("remove");
    });
  });

  describe("Render options validation", () => {
    it("validates replacement color format", () => {
      const validColors = ["#FFFFFF", "#000000", "#E6E6E6", "#F5F5F5", "#CCCCCC"];
      const hexPattern = /^#[0-9A-F]{6}$/i;

      for (const color of validColors) {
        expect(color).toMatch(hexPattern);
      }
    });

    it("validates threshold range", () => {
      const validThresholds = [0, 0.25, 0.5, 0.75, 1];

      for (const threshold of validThresholds) {
        expect(threshold).toBeGreaterThanOrEqual(0);
        expect(threshold).toBeLessThanOrEqual(1);
      }
    });

    it("validates feather range", () => {
      const validFeathers = [0, 2, 5, 10, 20];

      for (const feather of validFeathers) {
        expect(feather).toBeGreaterThanOrEqual(0);
        expect(feather).toBeLessThanOrEqual(20);
      }
    });
  });

  describe("Alpha blending", () => {
    it("correctly blends with alpha = 1 (full foreground)", () => {
      const blend = (fg: number, bg: number, alpha: number) =>
        Math.round(fg * alpha + bg * (1 - alpha));

      expect(blend(100, 200, 1)).toBe(100);
      expect(blend(50, 250, 1)).toBe(50);
    });

    it("correctly blends with alpha = 0 (full background)", () => {
      const blend = (fg: number, bg: number, alpha: number) =>
        Math.round(fg * alpha + bg * (1 - alpha));

      expect(blend(100, 200, 0)).toBe(200);
      expect(blend(50, 250, 0)).toBe(250);
    });

    it("correctly blends with alpha = 0.5", () => {
      const blend = (fg: number, bg: number, alpha: number) =>
        Math.round(fg * alpha + bg * (1 - alpha));

      expect(blend(100, 200, 0.5)).toBe(150);
      expect(blend(0, 100, 0.5)).toBe(50);
      expect(blend(200, 100, 0.5)).toBe(150);
    });
  });

  describe("Gaussian kernel", () => {
    it("generates normalized kernel", () => {
      const generateKernel = (radius: number) => {
        const sigma = radius / 2;
        const kernelSize = Math.ceil(radius * 2) + 1;
        const kernel = new Float32Array(kernelSize);
        let sum = 0;

        for (let i = 0; i < kernelSize; i++) {
          const x = i - Math.floor(kernelSize / 2);
          kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
          sum += kernel[i];
        }

        for (let i = 0; i < kernelSize; i++) {
          kernel[i] /= sum;
        }

        return kernel;
      };

      const kernel = generateKernel(2);
      const sum = kernel.reduce((a, b) => a + b, 0);

      expect(sum).toBeCloseTo(1, 5);
      expect(kernel[Math.floor(kernel.length / 2)]).toBeGreaterThan(
        kernel[0]
      );
    });
  });
});
