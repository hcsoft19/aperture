export type {
  SegmentationAdapter,
  SegmentationResult,
  SegmentationModelId,
  SegmentationFailureReason,
  BackgroundRemovalEdit,
  BrushStroke,
} from "./types";

export {
  SEGMENTATION_SCHEMA_VERSION,
  DEFAULT_BACKGROUND_REMOVAL,
  REPLACEMENT_COLOR_PRESETS,
  isSegmentationAvailable,
} from "./types";

export { LocalSegmentationAdapter, LOCAL_ADAPTER_VERSION } from "./local-adapter";
export { ManualSegmentationAdapter, MANUAL_ADAPTER_VERSION } from "./manual-adapter";

export {
  subscribeToModelLoader,
  getModelLoaderState,
  getAvailableAdapters,
  loadModel,
  segment,
  unloadModel,
  getCurrentModelId,
  isModelLoaded,
} from "./model-loader";
