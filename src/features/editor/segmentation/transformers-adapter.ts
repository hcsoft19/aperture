/**
 * On-device Transformers.js cutout.
 * The photograph stays in this browser. Only model weights are downloaded.
 */

import {
  CUTOUT_DOWNLOAD_MB,
  foregroundMask,
  openCutoutSession,
  type CutoutModelId,
  type CutoutSession,
} from "./cutout-model";
import type { SegmentationAdapter, SegmentationResult } from "./types";

export class TransformersSegmentationAdapter implements SegmentationAdapter {
  readonly name = "On-device cutout";
  readonly description = "Removes the background on this device. The photograph is not uploaded.";
  readonly downloadSizeMb = CUTOUT_DOWNLOAD_MB;

  private session: CutoutSession | null = null;

  constructor(readonly id: CutoutModelId) {}

  async isAvailable(): Promise<boolean> {
    return typeof window !== "undefined" && "OffscreenCanvas" in window && "WebAssembly" in window;
  }

  async loadModel(onProgress?: (progress: number) => void): Promise<void> {
    this.session?.dispose();
    this.session = await openCutoutSession(this.id, onProgress);
  }

  isLoaded(): boolean {
    return this.session != null;
  }

  unloadModel(): void {
    this.session?.dispose();
    this.session = null;
  }

  async segment(image: ImageBitmap, signal?: AbortSignal): Promise<SegmentationResult> {
    if (signal?.aborted) return { ok: false, reason: "cancelled" };
    if (!this.session) {
      return { ok: false, reason: "model_load_failed", message: "The cutout model is not loaded." };
    }

    const started = performance.now();
    try {
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext("2d");
      if (!context) {
        return { ok: false, reason: "unsupported_device", message: "This device cannot read the photograph." };
      }
      context.drawImage(image, 0, 0);
      const cutout = await this.session.remove(canvas);
      if (signal?.aborted) return { ok: false, reason: "cancelled" };

      return {
        ok: true,
        mask: foregroundMask(cutout, image.width, image.height),
        modelId: this.id,
        modelVersion: this.session.version,
        processingMs: Math.round(performance.now() - started),
      };
    } catch {
      return {
        ok: false,
        reason: "processing_failed",
        message: "The cutout could not be made on this device.",
      };
    }
  }
}
