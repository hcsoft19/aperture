/**
 * Background replacement renderer.
 *
 * Composites the original image foreground (determined by mask) over
 * a solid replacement color. Supports threshold and feather adjustments.
 */

import type { BackgroundRemovalEdit } from "./segmentation/types";

export interface RenderBackgroundOptions {
  source: ImageBitmap;
  mask: ImageData;
  replacementColor: string;
  threshold: number;
  feather: number;
}

export interface RenderBackgroundResult {
  imageData: ImageData;
  width: number;
  height: number;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return { r, g, b };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function renderBackgroundRemoval(
  options: RenderBackgroundOptions
): RenderBackgroundResult {
  const { source, mask, replacementColor, threshold, feather } = options;
  const { width, height } = source;

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Could not create canvas context");
  }

  context.drawImage(source, 0, 0);
  const sourceData = context.getImageData(0, 0, width, height);

  const bgColor = parseHexColor(replacementColor);

  const processedMask = applyThresholdAndFeather(mask, threshold, feather);

  const result = new ImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const offset = i * 4;

      const alpha = processedMask.data[offset] / 255;

      result.data[offset] = Math.round(
        sourceData.data[offset] * alpha + bgColor.r * (1 - alpha)
      );
      result.data[offset + 1] = Math.round(
        sourceData.data[offset + 1] * alpha + bgColor.g * (1 - alpha)
      );
      result.data[offset + 2] = Math.round(
        sourceData.data[offset + 2] * alpha + bgColor.b * (1 - alpha)
      );
      result.data[offset + 3] = 255;
    }
  }

  return { imageData: result, width, height };
}

function applyThresholdAndFeather(
  mask: ImageData,
  threshold: number,
  feather: number
): ImageData {
  const { width, height, data } = mask;
  const result = new ImageData(width, height);

  const thresholdValue = threshold * 255;
  const featherRadius = Math.max(0, Math.min(20, feather));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const offset = i * 4;

      let value = data[offset];

      if (value >= thresholdValue) {
        value = 255;
      } else if (value < thresholdValue - 50) {
        value = 0;
      } else {
        const t = (value - (thresholdValue - 50)) / 50;
        value = Math.round(t * 255);
      }

      result.data[offset] = value;
      result.data[offset + 1] = value;
      result.data[offset + 2] = value;
      result.data[offset + 3] = 255;
    }
  }

  if (featherRadius > 0) {
    applyGaussianBlur(result, featherRadius);
  }

  return result;
}

function applyGaussianBlur(imageData: ImageData, radius: number): void {
  const { width, height, data } = imageData;
  const temp = new Uint8ClampedArray(data.length);

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

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;

      for (let k = 0; k < kernelSize; k++) {
        const sx = clamp(x + k - Math.floor(kernelSize / 2), 0, width - 1);
        const offset = (y * width + sx) * 4;
        value += data[offset] * kernel[k];
      }

      const i = (y * width + x) * 4;
      temp[i] = Math.round(value);
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;

      for (let k = 0; k < kernelSize; k++) {
        const sy = clamp(y + k - Math.floor(kernelSize / 2), 0, height - 1);
        const offset = (sy * width + x) * 4;
        value += temp[offset] * kernel[k];
      }

      const i = (y * width + x) * 4;
      const final = Math.round(value);
      data[i] = final;
      data[i + 1] = final;
      data[i + 2] = final;
      data[i + 3] = 255;
    }
  }
}

export function applyBrushCorrections(
  mask: ImageData,
  corrections: BackgroundRemovalEdit["corrections"]
): ImageData {
  if (!corrections || corrections.strokes.length === 0) {
    return mask;
  }

  const { width, height, data } = mask;
  const result = new ImageData(new Uint8ClampedArray(data), width, height);

  for (const stroke of corrections.strokes) {
    const value = stroke.mode === "add" ? 255 : 0;
    const radiusPixels = Math.round(stroke.radius * Math.max(width, height));

    for (let i = 0; i < stroke.points.length; i++) {
      const [px, py] = stroke.points[i];
      const cx = Math.round(px * width);
      const cy = Math.round(py * height);

      for (let dy = -radiusPixels; dy <= radiusPixels; dy++) {
        for (let dx = -radiusPixels; dx <= radiusPixels; dx++) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > radiusPixels) continue;

          const x = cx + dx;
          const y = cy + dy;

          if (x < 0 || x >= width || y < 0 || y >= height) continue;

          const offset = (y * width + x) * 4;
          const falloff = 1 - distance / radiusPixels;
          const current = result.data[offset];
          const target = value;

          result.data[offset] = Math.round(
            current + (target - current) * falloff
          );
          result.data[offset + 1] = result.data[offset];
          result.data[offset + 2] = result.data[offset];
        }
      }

      if (i < stroke.points.length - 1) {
        const [nx, ny] = stroke.points[i + 1];
        const steps = Math.ceil(
          Math.hypot((nx - px) * width, (ny - py) * height)
        );

        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const mx = Math.round((px + (nx - px) * t) * width);
          const my = Math.round((py + (ny - py) * t) * height);

          for (let dy = -radiusPixels; dy <= radiusPixels; dy++) {
            for (let dx = -radiusPixels; dx <= radiusPixels; dx++) {
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance > radiusPixels) continue;

              const x = mx + dx;
              const y = my + dy;

              if (x < 0 || x >= width || y < 0 || y >= height) continue;

              const offset = (y * width + x) * 4;
              const falloff = 1 - distance / radiusPixels;
              const current = result.data[offset];
              const target = value;

              result.data[offset] = Math.round(
                current + (target - current) * falloff
              );
              result.data[offset + 1] = result.data[offset];
              result.data[offset + 2] = result.data[offset];
            }
          }
        }
      }
    }
  }

  return result;
}

export function createPreviewCanvas(
  result: RenderBackgroundResult
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = result.width;
  canvas.height = result.height;

  const context = canvas.getContext("2d");
  if (context) {
    context.putImageData(result.imageData, 0, 0);
  }

  return canvas;
}

export function createPreviewBlob(
  result: RenderBackgroundResult,
  mimeType: "image/jpeg" | "image/png" = "image/jpeg",
  quality = 0.92
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = createPreviewCanvas(result);
    canvas.toBlob(resolve, mimeType, quality);
  });
}
