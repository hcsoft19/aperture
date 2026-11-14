/**
 * Local on-device segmentation adapter.
 *
 * Uses browser-based image processing for background removal.
 * No images are sent to external services.
 *
 * Current implementation: Edge-detection heuristic (fallback)
 * Future: Transformers.js with RMBG/IS-Net ONNX models
 */

import type {
  SegmentationAdapter,
  SegmentationResult,
  SegmentationModelId,
} from "./types";

export const LOCAL_ADAPTER_VERSION = "local-heuristic-1.0.0";

const EDGE_THRESHOLD = 30;
const BLUR_RADIUS = 2;
const MIN_FOREGROUND_RATIO = 0.05;
const MAX_FOREGROUND_RATIO = 0.95;

export class LocalSegmentationAdapter implements SegmentationAdapter {
  readonly id: SegmentationModelId = "rmbg-1.4";
  readonly name = "Local Background Removal";
  readonly description =
    "On-device background detection using edge analysis (no external processing)";
  readonly downloadSizeMb = 0;

  private loaded = false;
  private canvas: OffscreenCanvas | null = null;
  private context: OffscreenCanvasRenderingContext2D | null = null;

  async isAvailable(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (!("OffscreenCanvas" in window)) return false;
    if (!("createImageBitmap" in window)) return false;

    try {
      const test = new OffscreenCanvas(1, 1);
      const ctx = test.getContext("2d");
      return ctx !== null;
    } catch {
      return false;
    }
  }

  async loadModel(onProgress?: (progress: number) => void): Promise<void> {
    onProgress?.(0);
    this.canvas = new OffscreenCanvas(1, 1);
    this.context = this.canvas.getContext("2d", { willReadFrequently: true });
    onProgress?.(100);
    this.loaded = true;
  }

  async segment(
    image: ImageBitmap,
    signal?: AbortSignal
  ): Promise<SegmentationResult> {
    if (signal?.aborted) {
      return { ok: false, reason: "cancelled" };
    }

    if (!this.loaded || !this.canvas || !this.context) {
      return {
        ok: false,
        reason: "model_load_failed",
        message: "Adapter not loaded",
      };
    }

    const startTime = performance.now();

    try {
      this.canvas.width = image.width;
      this.canvas.height = image.height;

      this.context.drawImage(image, 0, 0);
      const imageData = this.context.getImageData(
        0,
        0,
        image.width,
        image.height
      );

      if (signal?.aborted) {
        return { ok: false, reason: "cancelled" };
      }

      const mask = this.computeMask(imageData, signal);

      if (signal?.aborted) {
        return { ok: false, reason: "cancelled" };
      }

      const foregroundRatio = this.countForeground(mask) / (mask.width * mask.height);

      if (foregroundRatio < MIN_FOREGROUND_RATIO || foregroundRatio > MAX_FOREGROUND_RATIO) {
        return {
          ok: false,
          reason: "processing_failed",
          message: "Could not reliably separate foreground from background",
        };
      }

      const processingMs = performance.now() - startTime;

      return {
        ok: true,
        mask,
        modelId: this.id,
        modelVersion: LOCAL_ADAPTER_VERSION,
        processingMs,
      };
    } catch (error) {
      return {
        ok: false,
        reason: "processing_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  unloadModel(): void {
    this.canvas = null;
    this.context = null;
    this.loaded = false;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  private computeMask(
    imageData: ImageData,
    signal?: AbortSignal
  ): ImageData {
    const { width, height, data } = imageData;
    const mask = new ImageData(width, height);
    const gray = new Float32Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const offset = i * 4;
      gray[i] = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
    }

    if (signal?.aborted) return mask;

    const edges = this.detectEdges(gray, width, height);

    if (signal?.aborted) return mask;

    const borderColor = this.sampleBorderColor(data, width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const offset = i * 4;

        const edgeValue = edges[i];
        const colorDistance = this.colorDistance(
          data[offset],
          data[offset + 1],
          data[offset + 2],
          borderColor.r,
          borderColor.g,
          borderColor.b
        );

        const isForeground =
          edgeValue > EDGE_THRESHOLD * 2 || colorDistance > EDGE_THRESHOLD * 3;

        const alpha = isForeground ? 255 : 0;
        mask.data[offset] = alpha;
        mask.data[offset + 1] = alpha;
        mask.data[offset + 2] = alpha;
        mask.data[offset + 3] = 255;
      }
    }

    if (signal?.aborted) return mask;

    this.dilateAndErode(mask, BLUR_RADIUS);

    return mask;
  }

  private detectEdges(
    gray: Float32Array,
    width: number,
    height: number
  ): Float32Array {
    const edges = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;

        const gx =
          -gray[i - width - 1] -
          2 * gray[i - 1] -
          gray[i + width - 1] +
          gray[i - width + 1] +
          2 * gray[i + 1] +
          gray[i + width + 1];

        const gy =
          -gray[i - width - 1] -
          2 * gray[i - width] -
          gray[i - width + 1] +
          gray[i + width - 1] +
          2 * gray[i + width] +
          gray[i + width + 1];

        edges[i] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    return edges;
  }

  private sampleBorderColor(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): { r: number; g: number; b: number } {
    let r = 0,
      g = 0,
      b = 0,
      count = 0;

    for (let x = 0; x < width; x++) {
      let offset = x * 4;
      r += data[offset];
      g += data[offset + 1];
      b += data[offset + 2];
      count++;

      offset = ((height - 1) * width + x) * 4;
      r += data[offset];
      g += data[offset + 1];
      b += data[offset + 2];
      count++;
    }

    for (let y = 1; y < height - 1; y++) {
      let offset = y * width * 4;
      r += data[offset];
      g += data[offset + 1];
      b += data[offset + 2];
      count++;

      offset = (y * width + width - 1) * 4;
      r += data[offset];
      g += data[offset + 1];
      b += data[offset + 2];
      count++;
    }

    return {
      r: r / count,
      g: g / count,
      b: b / count,
    };
  }

  private colorDistance(
    r1: number,
    g1: number,
    b1: number,
    r2: number,
    g2: number,
    b2: number
  ): number {
    return Math.sqrt(
      (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2
    );
  }

  private dilateAndErode(mask: ImageData, radius: number): void {
    const { width, height, data } = mask;
    const temp = new Uint8Array(width * height);

    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let maxVal = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const offset = ((y + dy) * width + (x + dx)) * 4;
            maxVal = Math.max(maxVal, data[offset]);
          }
        }
        temp[y * width + x] = maxVal;
      }
    }

    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let minVal = 255;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            minVal = Math.min(minVal, temp[(y + dy) * width + (x + dx)]);
          }
        }
        const offset = (y * width + x) * 4;
        data[offset] = minVal;
        data[offset + 1] = minVal;
        data[offset + 2] = minVal;
      }
    }
  }

  private countForeground(mask: ImageData): number {
    let count = 0;
    for (let i = 0; i < mask.data.length; i += 4) {
      if (mask.data[i] > 127) count++;
    }
    return count;
  }
}
