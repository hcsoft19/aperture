import { describe, expect, it } from "vitest";
import { commitHistory, createHistory, redoHistory, undoHistory } from "@/features/editor/history";
import { layoutEdit, paintMasks, rotatePoint } from "@/features/editor/layout";
import { emptyEdit, parseEdit, presentationEdited, type EditDocument } from "@/features/editor/schema";

describe("photo edits", () => {
  it("rejects a privacy bar that leaves the photograph", () => {
    const edit = emptyEdit();
    edit.privacyMasks.push({
      id: "11111111-1111-4111-8111-111111111111",
      type: "rectangle",
      fill: "#000000",
      x: 0.8,
      y: 0.2,
      width: 0.4,
      height: 0.1,
      rotation: 0,
      order: 0,
    });
    expect(parseEdit(edit)).toBeNull();
  });

  it("undoes one gesture and drops redo after a new change", () => {
    const start = createHistory(emptyEdit());
    const moved = commitHistory(start, { ...emptyEdit(), view: { zoom: 2, panX: 0, panY: 0 } });
    const undone = undoHistory(moved);
    expect(undone.present.view.zoom).toBe(1);
    const redone = redoHistory(undone);
    expect(redone.present.view.zoom).toBe(2);
    const replaced = commitHistory(undone, emptyEdit());
    expect(replaced.future).toHaveLength(0);
  });

  it("flattens a black bar over the original pixels", () => {
    const width = 4;
    const height = 2;
    const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
    const edit = emptyEdit();
    edit.privacyMasks.push({
      id: "11111111-1111-4111-8111-111111111111",
      type: "rectangle",
      fill: "#000000",
      x: 0,
      y: 0,
      width: 0.5,
      height: 1,
      rotation: 0,
      order: 0,
    });
    const layout = layoutEdit(width, height, edit);
    const painted = paintMasks(pixels, width, height, layout.masks);
    expect(painted[0]).toBe(0);
    expect(painted[4]).toBe(0);
    expect(painted[8]).toBe(255);
    expect(painted).not.toBe(pixels);
    expect(presentationEdited(edit)).toBe(true);
  });

  it("keeps an untouched photograph unmarked", () => {
    const edit = emptyEdit();
    const layout = layoutEdit(100, 200, edit);
    expect(layout.width).toBe(100);
    expect(layout.height).toBe(200);
    expect(layout.presentationEdited).toBe(false);
    expect(presentationEdited(edit)).toBe(false);
  });

  it("turns a clockwise point downward", () => {
    expect(rotatePoint(1, 0, 0, 0, 90).y).toBeCloseTo(1);
  });

  it("keeps an older edit readable and marks background removal as a presentation edit", () => {
    const stored = emptyEdit();
    const { backgroundRemoval: _removed, ...older } = stored;
    const parsed = parseEdit(older);
    expect(parsed?.backgroundRemoval.enabled).toBe(false);
    const removed = parseEdit({
      ...stored,
      backgroundRemoval: { ...stored.backgroundRemoval, enabled: true, replacementColor: "#FFFFFF" },
    });
    expect(removed?.backgroundRemoval.replacementColor).toBe("#FFFFFF");
    expect(removed ? presentationEdited(removed) : false).toBe(true);
  });

  it("adds canvas padding without changing the source size stored on the edit", () => {
    const edit: EditDocument = {
      ...emptyEdit(),
      canvas: { background: "#FFFFFF", padding: 10, outputAspect: "original" },
    };
    const layout = layoutEdit(40, 40, edit);
    expect(layout.width).toBe(60);
    expect(layout.height).toBe(60);
    expect(layout.background).toBe("#FFFFFF");
  });
});
