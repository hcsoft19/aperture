import { describe, expect, it } from "vitest";
import { moveCrop, pinchView, resizeCrop, resizeMask } from "@/features/editor/gestures";
import { emptyEdit } from "@/features/editor/schema";

describe("editor gestures", () => {
  it("zooms with two fingers and keeps the view inside its limits", () => {
    const view = pinchView({ zoom: 1, panX: 0, panY: 0 }, 100, 200, 40, -20);
    expect(view.zoom).toBe(2);
    expect(view.panX).toBeCloseTo(0.2);
    expect(view.panY).toBeCloseTo(-0.1);
    expect(pinchView({ zoom: 2, panX: 0, panY: 0 }, 10, 100, 0, 0).zoom).toBe(3);
  });

  it("moves a crop inside the photograph", () => {
    const crop = { ...emptyEdit().crop, x: 0.2, y: 0.2, width: 0.4, height: 0.4 };
    const moved = moveCrop(crop, -1, 0.1);
    expect(moved.x).toBe(0);
    expect(moved.y).toBeCloseTo(0.3);
    expect(moved.width).toBe(0.4);
    expect(moved.height).toBe(0.4);
  });

  it("resizes a fixed crop without leaving the photograph", () => {
    const crop = { ...emptyEdit().crop, aspect: "1:1" as const, x: 0.1, y: 0.1, width: 0.4, height: 0.4 };
    const next = resizeCrop(crop, 0.2, 0.05);
    expect(next.width).toBeCloseTo(next.height);
    expect(next.x + next.width).toBeLessThanOrEqual(1);
    const mask = resizeMask({ x: 0.8, y: 0.8, width: 0.1, height: 0.1 }, 0.5, 0.5);
    expect(mask.width).toBeCloseTo(0.2);
    expect(mask.height).toBeCloseTo(0.2);
  });
});
