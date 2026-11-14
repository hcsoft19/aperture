/**
 * Segmentation model loader.
 *
 * Manages adapter lifecycle and provides a clean API for the editor.
 * Ensures only one model is loaded at a time to conserve memory.
 */

import type {
  SegmentationAdapter,
  SegmentationModelId,
  SegmentationResult,
} from "./types";
import { LocalSegmentationAdapter } from "./local-adapter";
import { ManualSegmentationAdapter } from "./manual-adapter";

type LoadingState = "idle" | "loading" | "loaded" | "error";

interface ModelLoaderState {
  adapter: SegmentationAdapter | null;
  loadingState: LoadingState;
  loadingProgress: number;
  error: string | null;
}

const adapters: Record<SegmentationModelId, () => SegmentationAdapter> = {
  "rmbg-1.4": () => new LocalSegmentationAdapter(),
  "isnet-general-use": () => new LocalSegmentationAdapter(),
  "modnet": () => new LocalSegmentationAdapter(),
  manual: () => new ManualSegmentationAdapter(),
};

let state: ModelLoaderState = {
  adapter: null,
  loadingState: "idle",
  loadingProgress: 0,
  error: null,
};

const listeners: Set<() => void> = new Set();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToModelLoader(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getModelLoaderState(): Readonly<ModelLoaderState> {
  return state;
}

export async function getAvailableAdapters(): Promise<
  Array<{
    id: SegmentationModelId;
    name: string;
    description: string;
    downloadSizeMb: number;
    available: boolean;
  }>
> {
  const results: Array<{
    id: SegmentationModelId;
    name: string;
    description: string;
    downloadSizeMb: number;
    available: boolean;
  }> = [];

  for (const [id, factory] of Object.entries(adapters) as [
    SegmentationModelId,
    () => SegmentationAdapter
  ][]) {
    const adapter = factory();
    const available = await adapter.isAvailable();
    results.push({
      id,
      name: adapter.name,
      description: adapter.description,
      downloadSizeMb: adapter.downloadSizeMb,
      available,
    });
  }

  return results;
}

export async function loadModel(
  modelId: SegmentationModelId,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  if (state.adapter?.id === modelId && state.adapter.isLoaded()) {
    return true;
  }

  if (state.adapter) {
    state.adapter.unloadModel();
  }

  const factory = adapters[modelId];
  if (!factory) {
    state = {
      adapter: null,
      loadingState: "error",
      loadingProgress: 0,
      error: `Unknown model: ${modelId}`,
    };
    notifyListeners();
    return false;
  }

  const adapter = factory();

  const available = await adapter.isAvailable();
  if (!available) {
    state = {
      adapter: null,
      loadingState: "error",
      loadingProgress: 0,
      error: "This device does not support background removal",
    };
    notifyListeners();
    return false;
  }

  state = {
    adapter,
    loadingState: "loading",
    loadingProgress: 0,
    error: null,
  };
  notifyListeners();

  try {
    await adapter.loadModel((progress) => {
      state = { ...state, loadingProgress: progress };
      notifyListeners();
      onProgress?.(progress);
    });

    state = {
      adapter,
      loadingState: "loaded",
      loadingProgress: 100,
      error: null,
    };
    notifyListeners();
    return true;
  } catch (error) {
    state = {
      adapter: null,
      loadingState: "error",
      loadingProgress: 0,
      error: error instanceof Error ? error.message : "Failed to load model",
    };
    notifyListeners();
    return false;
  }
}

export async function segment(
  image: ImageBitmap,
  signal?: AbortSignal
): Promise<SegmentationResult> {
  if (!state.adapter || !state.adapter.isLoaded()) {
    return {
      ok: false,
      reason: "model_load_failed",
      message: "No model is loaded",
    };
  }

  return state.adapter.segment(image, signal);
}

export function unloadModel(): void {
  if (state.adapter) {
    state.adapter.unloadModel();
  }
  state = {
    adapter: null,
    loadingState: "idle",
    loadingProgress: 0,
    error: null,
  };
  notifyListeners();
}

export function getCurrentModelId(): SegmentationModelId | null {
  return state.adapter?.id ?? null;
}

export function isModelLoaded(): boolean {
  return state.loadingState === "loaded" && state.adapter?.isLoaded() === true;
}

/** Named cutout models currently share the on-device edge heuristic. */
export function modelUsesEdgeHeuristic(modelId: SegmentationModelId): boolean {
  const factory = adapters[modelId];
  if (!factory) return false;
  return factory() instanceof LocalSegmentationAdapter;
}
