/**
 * On-device cutout. Model weights may download to this browser.
 * The photograph is never sent to a model host.
 */

import type { SegmentationModelId } from "./types";

export const CUTOUT_DOWNLOAD_MB = 44;

const CUTOUT_REPOS = {
  "rmbg-1.4": ["briaai/RMBG-1.4", "Xenova/modnet", "onnx-community/ISNet-ONNX"],
  "isnet-general-use": ["onnx-community/ISNet-ONNX", "briaai/RMBG-1.4", "Xenova/modnet"],
  modnet: ["Xenova/modnet", "briaai/RMBG-1.4", "onnx-community/ISNet-ONNX"],
} as const;

const RMBG_PROCESSOR = {
  do_normalize: true,
  do_pad: false,
  do_rescale: true,
  do_resize: true,
  image_mean: [0.5, 0.5, 0.5],
  image_std: [1, 1, 1],
  feature_extractor_type: "ImageFeatureExtractor",
  resample: 2,
  rescale_factor: 1 / 255,
  size: { width: 1024, height: 1024 },
} as const;

export type CutoutModelId = Exclude<SegmentationModelId, "manual">;

export type CutoutPixels = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  channels: number;
};

export type CutoutSession = {
  version: string;
  remove: (canvas: OffscreenCanvas) => Promise<CutoutPixels>;
  dispose: () => void;
};

type ProgressUpdate = {
  status?: string;
  progress?: number;
};

export function cutoutRepos(modelId: CutoutModelId): readonly string[] {
  return CUTOUT_REPOS[modelId];
}

export function downloadProgress(update: ProgressUpdate): number | null {
  if (update.status === "done" || update.status === "ready") return 100;
  if (update.status !== "progress" || typeof update.progress !== "number") return null;
  const value = update.progress <= 1 ? update.progress * 100 : update.progress;
  return Math.max(0, Math.min(100, value));
}

export function sampleMask(
  values: ArrayLike<number>,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / width));
      const value = values[sourceY * sourceWidth + sourceX] ?? 0;
      const scaled = value > 1 ? value : value * 255;
      data[y * width + x] = Math.max(0, Math.min(255, Math.round(scaled)));
    }
  }
  return data;
}

export function foregroundMask(image: CutoutPixels, width = image.width, height = image.height): ImageData {
  const mask = new ImageData(width, height);
  const channel = image.channels >= 4 ? 3 : 0;
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor((y * image.height) / height));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor((x * image.width) / width));
      const value = image.data[(sourceY * image.width + sourceX) * image.channels + channel] ?? 0;
      const offset = (y * width + x) * 4;
      mask.data[offset] = value;
      mask.data[offset + 1] = value;
      mask.data[offset + 2] = value;
      mask.data[offset + 3] = 255;
    }
  }
  return mask;
}

type OpenCutout = (
  repo: string,
  onProgress?: (progress: number) => void,
) => Promise<CutoutSession>;

function reportDownload(update: ProgressUpdate, onProgress?: (progress: number) => void) {
  const progress = downloadProgress(update);
  if (progress != null) onProgress?.(progress);
}

function inferenceDevice(): "wasm" | "cpu" {
  return typeof window === "undefined" ? "cpu" : "wasm";
}

async function openRmbgCutout(onProgress?: (progress: number) => void): Promise<CutoutSession> {
  const { env, AutoModel, AutoProcessor, RawImage } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  env.useBrowserCache = true;
  const progress_callback = (update: ProgressUpdate) => reportDownload(update, onProgress);

  const model = await AutoModel.from_pretrained("briaai/RMBG-1.4", {
    config: { model_type: "custom" } as never,
    device: inferenceDevice(),
    dtype: "q8",
    progress_callback,
  });
  const processor = await AutoProcessor.from_pretrained("briaai/RMBG-1.4", {
    config: RMBG_PROCESSOR as never,
    progress_callback,
  });

  return {
    version: "briaai/RMBG-1.4",
    async remove(canvas) {
      const image = await RawImage.read(canvas);
      const prepared = await processor(image);
      const result = await model({ input: prepared.pixel_values });
      const output = result.output;
      const sourceHeight = output.dims.at(-2) ?? image.height;
      const sourceWidth = output.dims.at(-1) ?? image.width;
      return {
        data: sampleMask(output.data, sourceWidth, sourceHeight, image.width, image.height),
        width: image.width,
        height: image.height,
        channels: 1,
      };
    },
    dispose() {
      void model.dispose?.();
    },
  };
}

async function openPipelineCutout(
  repo: string,
  onProgress?: (progress: number) => void,
): Promise<CutoutSession> {
  const { env, pipeline } = await import("@huggingface/transformers");
  env.allowLocalModels = false;
  env.useBrowserCache = true;

  const segmenter = await pipeline("background-removal", repo, {
    device: inferenceDevice(),
    dtype: "q8",
    progress_callback: (update: ProgressUpdate) => reportDownload(update, onProgress),
  });

  return {
    version: repo,
    async remove(canvas) {
      const output = await segmenter(canvas);
      const image = Array.isArray(output) ? output[0] : output;
      return {
        data: image.data,
        width: image.width,
        height: image.height,
        channels: image.channels,
      };
    },
    dispose() {
      void segmenter.dispose?.();
    },
  };
}

async function openTransformersCutout(
  repo: string,
  onProgress?: (progress: number) => void,
): Promise<CutoutSession> {
  if (repo === "briaai/RMBG-1.4") return openRmbgCutout(onProgress);
  return openPipelineCutout(repo, onProgress);
}

export async function openCutoutSession(
  modelId: CutoutModelId,
  onProgress?: (progress: number) => void,
  open: OpenCutout = openTransformersCutout,
): Promise<CutoutSession> {
  let lastError: unknown;
  for (const repo of cutoutRepos(modelId)) {
    try {
      return await open(repo, onProgress);
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof Error && lastError.message === "The cutout could not be loaded on this device.") {
    throw lastError;
  }
  throw new Error("The cutout could not be loaded on this device.");
}
