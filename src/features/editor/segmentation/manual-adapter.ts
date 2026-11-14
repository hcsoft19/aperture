/**
 * Manual segmentation adapter.
 *
 * Provides a blank mask that the user paints manually with brush tools.
 * Used when automatic segmentation is unavailable or unsatisfactory.
 */

import type {
  SegmentationAdapter,
  SegmentationResult,
} from "./types";

export const MANUAL_ADAPTER_VERSION = "manual-1.0.0";

export class ManualSegmentationAdapter implements SegmentationAdapter {
  readonly id = "manual" as const;
  readonly name = "Manual Selection";
  readonly description = "Draw the foreground manually with brush tools";
  readonly downloadSizeMb = 0;

  private loaded = false;

  async isAvailable(): Promise<boolean> {
    return typeof window !== "undefined" && "OffscreenCanvas" in window;
  }

  async loadModel(): Promise<void> {
    this.loaded = true;
  }

  async segment(
    image: ImageBitmap,
    signal?: AbortSignal
  ): Promise<SegmentationResult> {
    if (signal?.aborted) {
      return { ok: false, reason: "cancelled" };
    }

    const startTime = performance.now();

    const canvas = new OffscreenCanvas(image.width, image.height);
    const context = canvas.getContext("2d");

    if (!context) {
      return {
        ok: false,
        reason: "processing_failed",
        message: "Could not create canvas context",
      };
    }

    const mask = context.createImageData(image.width, image.height);
    for (let i = 0; i < mask.data.length; i += 4) {
      mask.data[i] = 255;
      mask.data[i + 1] = 255;
      mask.data[i + 2] = 255;
      mask.data[i + 3] = 255;
    }

    const processingMs = performance.now() - startTime;

    return {
      ok: true,
      mask,
      modelId: "manual",
      modelVersion: MANUAL_ADAPTER_VERSION,
      processingMs,
    };
  }

  unloadModel(): void {
    this.loaded = false;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}
