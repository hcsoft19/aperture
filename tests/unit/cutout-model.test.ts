import { describe, expect, it } from "vitest";

if (typeof globalThis.ImageData === "undefined") {
  class TestImageData {
    readonly data: Uint8ClampedArray;
    constructor(width: number, height: number) {
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  }
  globalThis.ImageData = TestImageData as unknown as typeof ImageData;
}

import { modelUsesEdgeHeuristic } from "@/features/editor/segmentation";
import {
  cutoutRepos,
  downloadProgress,
  foregroundMask,
  openCutoutSession,
  sampleMask,
} from "@/features/editor/segmentation/cutout-model";

describe("on-device cutout", () => {
  it("does not treat the default cutout model as the edge heuristic", () => {
    expect(modelUsesEdgeHeuristic("rmbg-1.4")).toBe(false);
    expect(modelUsesEdgeHeuristic("isnet-general-use")).toBe(false);
    expect(modelUsesEdgeHeuristic("modnet")).toBe(false);
  });

  it("tries RMBG-1.4 before the smaller on-device models", () => {
    expect(cutoutRepos("rmbg-1.4")).toEqual([
      "briaai/RMBG-1.4",
      "Xenova/modnet",
      "onnx-community/ISNet-ONNX",
    ]);
  });

  it("reads download progress without sending the photograph", () => {
    expect(downloadProgress({ status: "progress", progress: 25 })).toBe(25);
    expect(downloadProgress({ status: "progress", progress: 0.5 })).toBe(50);
    expect(downloadProgress({ status: "ready" })).toBe(100);
    expect(downloadProgress({ status: "initiate" })).toBeNull();
  });

  it("samples a model mask back to the photograph size", () => {
    const sampled = sampleMask([0, 1, 0, 1], 2, 2, 2, 2);
    expect(Array.from(sampled)).toEqual([0, 255, 0, 255]);
  });

  it("uses the alpha channel as the foreground mask", () => {
    const mask = foregroundMask({
      data: new Uint8ClampedArray([0, 0, 0, 10, 0, 0, 0, 240]),
      width: 2,
      height: 1,
      channels: 4,
    });

    expect(mask.data[0]).toBe(10);
    expect(mask.data[4]).toBe(240);
  });

  it("loads the next on-device model when the first one fails", async () => {
    const opened: string[] = [];
    const session = await openCutoutSession("rmbg-1.4", undefined, async (repo) => {
      opened.push(repo);
      if (repo !== "Xenova/modnet") throw new Error("missing");
      return {
        version: repo,
        async remove() {
          return { data: new Uint8ClampedArray([255]), width: 1, height: 1, channels: 1 };
        },
        dispose() {},
      };
    });

    expect(opened[0]).toBe("briaai/RMBG-1.4");
    expect(session.version).toBe("Xenova/modnet");
  });

  it("says the cutout could not be loaded when every on-device model fails", async () => {
    await expect(
      openCutoutSession("rmbg-1.4", undefined, async () => {
        throw new Error("network");
      }),
    ).rejects.toThrow("The cutout could not be loaded on this device.");
  });
});
