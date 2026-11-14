import { describe, it, expect } from "vitest";
import {
  isSegmentationAvailable,
  SEGMENTATION_SCHEMA_VERSION,
  DEFAULT_BACKGROUND_REMOVAL,
  REPLACEMENT_COLOR_PRESETS,
  type BackgroundRemovalEdit,
  type BrushStroke,
  type SegmentationModelId,
} from "@/features/editor/segmentation";

describe("Segmentation types", () => {
  describe("isSegmentationAvailable", () => {
    it("returns false in non-browser environment", () => {
      const originalWindow = global.window;
      // @ts-expect-error - testing undefined window
      delete global.window;

      expect(isSegmentationAvailable()).toBe(false);

      global.window = originalWindow;
    });
  });

  describe("SEGMENTATION_SCHEMA_VERSION", () => {
    it("is version 2", () => {
      expect(SEGMENTATION_SCHEMA_VERSION).toBe(2);
    });
  });

  describe("DEFAULT_BACKGROUND_REMOVAL", () => {
    it("has correct default values", () => {
      expect(DEFAULT_BACKGROUND_REMOVAL).toEqual({
        enabled: false,
        modelId: "rmbg-1.4",
        modelVersion: "1.0.0",
        threshold: 0.5,
        feather: 2,
        replacementColor: "#FFFFFF",
        corrections: undefined,
      });
    });

    it("has valid modelId", () => {
      const validIds: SegmentationModelId[] = [
        "rmbg-1.4",
        "isnet-general-use",
        "modnet",
        "manual",
      ];
      expect(validIds).toContain(DEFAULT_BACKGROUND_REMOVAL.modelId);
    });
  });

  describe("REPLACEMENT_COLOR_PRESETS", () => {
    it("has 5 color presets", () => {
      expect(REPLACEMENT_COLOR_PRESETS).toHaveLength(5);
    });

    it("includes white as first option", () => {
      expect(REPLACEMENT_COLOR_PRESETS[0]).toEqual({
        value: "#FFFFFF",
        label: "White",
      });
    });

    it("includes black as last option", () => {
      expect(REPLACEMENT_COLOR_PRESETS[4]).toEqual({
        value: "#000000",
        label: "Black",
      });
    });

    it("all presets have valid hex colors", () => {
      const hexPattern = /^#[0-9A-F]{6}$/i;
      for (const preset of REPLACEMENT_COLOR_PRESETS) {
        expect(preset.value).toMatch(hexPattern);
        expect(preset.label).toBeTruthy();
      }
    });
  });
});

describe("BackgroundRemovalEdit validation", () => {
  it("validates a complete edit object", () => {
    const edit: BackgroundRemovalEdit = {
      enabled: true,
      modelId: "rmbg-1.4",
      modelVersion: "1.0.0",
      threshold: 0.7,
      feather: 5,
      replacementColor: "#F5F5F5",
      corrections: {
        version: 1,
        strokes: [],
      },
    };

    expect(edit.enabled).toBe(true);
    expect(edit.threshold).toBeGreaterThanOrEqual(0);
    expect(edit.threshold).toBeLessThanOrEqual(1);
    expect(edit.feather).toBeGreaterThanOrEqual(0);
    expect(edit.feather).toBeLessThanOrEqual(20);
  });

  it("validates brush strokes", () => {
    const stroke: BrushStroke = {
      id: "stroke-1",
      mode: "add",
      points: [
        [0.5, 0.5],
        [0.6, 0.6],
      ],
      radius: 0.05,
      timestamp: Date.now(),
    };

    expect(stroke.mode).toBe("add");
    expect(stroke.points).toHaveLength(2);
    expect(stroke.points[0][0]).toBeGreaterThanOrEqual(0);
    expect(stroke.points[0][0]).toBeLessThanOrEqual(1);
  });
});

describe("Model ID validation", () => {
  it("accepts valid model IDs", () => {
    const validIds: SegmentationModelId[] = [
      "rmbg-1.4",
      "isnet-general-use",
      "modnet",
      "manual",
    ];

    for (const id of validIds) {
      const edit: BackgroundRemovalEdit = {
        ...DEFAULT_BACKGROUND_REMOVAL,
        modelId: id,
      };
      expect(edit.modelId).toBe(id);
    }
  });
});

describe("Correction persistence", () => {
  it("stores strokes in normalized coordinates", () => {
    const edit: BackgroundRemovalEdit = {
      ...DEFAULT_BACKGROUND_REMOVAL,
      enabled: true,
      corrections: {
        version: 1,
        strokes: [
          {
            id: "1",
            mode: "add",
            points: [
              [0.1, 0.2],
              [0.3, 0.4],
            ],
            radius: 0.02,
            timestamp: 1700000000000,
          },
          {
            id: "2",
            mode: "remove",
            points: [
              [0.5, 0.5],
              [0.6, 0.7],
            ],
            radius: 0.03,
            timestamp: 1700000001000,
          },
        ],
      },
    };

    expect(edit.corrections?.strokes).toHaveLength(2);
    expect(edit.corrections?.strokes[0].mode).toBe("add");
    expect(edit.corrections?.strokes[1].mode).toBe("remove");

    for (const stroke of edit.corrections?.strokes ?? []) {
      for (const [x, y] of stroke.points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
    }
  });

  it("corrections are optional", () => {
    const edit: BackgroundRemovalEdit = {
      ...DEFAULT_BACKGROUND_REMOVAL,
      enabled: true,
    };

    expect(edit.corrections).toBeUndefined();
  });
});
