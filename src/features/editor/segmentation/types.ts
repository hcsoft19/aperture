/**
 * Provider-agnostic segmentation interface for background removal.
 *
 * All processing happens on-device. Images are never sent to external services.
 * The result is an alpha mask used to composite foreground over a replacement color.
 */

export const SEGMENTATION_SCHEMA_VERSION = 2;

export type SegmentationModelId =
  | "rmbg-1.4"
  | "isnet-general-use"
  | "modnet"
  | "manual";

export type SegmentationFailureReason =
  | "unsupported_device"
  | "model_load_failed"
  | "processing_failed"
  | "cancelled"
  | "memory_exceeded";

export type SegmentationResult =
  | {
      ok: true;
      mask: ImageData;
      modelId: SegmentationModelId;
      modelVersion: string;
      processingMs: number;
    }
  | {
      ok: false;
      reason: SegmentationFailureReason;
      message?: string;
    };

export interface SegmentationAdapter {
  readonly id: SegmentationModelId;
  readonly name: string;
  readonly description: string;
  readonly downloadSizeMb: number;

  isAvailable(): Promise<boolean>;
  loadModel(onProgress?: (progress: number) => void): Promise<void>;
  segment(
    image: ImageBitmap,
    signal?: AbortSignal
  ): Promise<SegmentationResult>;
  unloadModel(): void;
  isLoaded(): boolean;
}

export type BrushStroke = {
  id: string;
  mode: "add" | "remove";
  points: [number, number][];
  radius: number;
  timestamp: number;
};

export type BackgroundRemovalEdit = {
  enabled: boolean;
  modelId: SegmentationModelId;
  modelVersion: string;
  threshold: number;
  feather: number;
  replacementColor: string;
  corrections?: {
    version: 1;
    strokes: BrushStroke[];
  };
};

export const DEFAULT_BACKGROUND_REMOVAL: BackgroundRemovalEdit = {
  enabled: false,
  modelId: "rmbg-1.4",
  modelVersion: "1.0.0",
  threshold: 0.5,
  feather: 2,
  replacementColor: "#FFFFFF",
  corrections: undefined,
};

export const REPLACEMENT_COLOR_PRESETS = [
  { value: "#FFFFFF", label: "White" },
  { value: "#F5F5F5", label: "Off-white" },
  { value: "#E6E6E6", label: "Light gray" },
  { value: "#CCCCCC", label: "Gray" },
  { value: "#000000", label: "Black" },
] as const;

export function isSegmentationAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return "createImageBitmap" in window && "OffscreenCanvas" in window;
}
