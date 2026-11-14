"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ColorPicker } from "./color-picker";
import {
  DEFAULT_BACKGROUND_REMOVAL,
  getModelLoaderState,
  isModelLoaded,
  loadModel,
  segment,
  subscribeToModelLoader,
  type BackgroundRemovalEdit,
  type SegmentationModelId,
  type SegmentationResult,
} from "./segmentation";
import {
  applyBrushCorrections,
  renderBackgroundRemoval,
  type RenderBackgroundResult,
} from "./background-renderer";

interface BackgroundToolProps {
  enabled: boolean;
  edit: BackgroundRemovalEdit;
  bitmap: ImageBitmap | null;
  onChange: (edit: BackgroundRemovalEdit) => void;
  onPreviewReady: (result: RenderBackgroundResult | null) => void;
}

type ProcessingState = "idle" | "loading" | "processing" | "ready" | "error";

export function BackgroundTool({
  enabled,
  edit,
  bitmap,
  onChange,
  onPreviewReady,
}: BackgroundToolProps) {
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mask, setMask] = useState<ImageData | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return subscribeToModelLoader(() => {
      const state = getModelLoaderState();
      setLoadingProgress(state.loadingProgress);
      if (state.error) {
        setError(state.error);
        setProcessingState("error");
      }
    });
  }, []);

  useEffect(() => {
    if (!enabled || !bitmap || !mask) {
      onPreviewReady(null);
      return;
    }

    const processedMask = edit.corrections
      ? applyBrushCorrections(mask, edit.corrections)
      : mask;

    const result = renderBackgroundRemoval({
      source: bitmap,
      mask: processedMask,
      replacementColor: edit.replacementColor,
      threshold: edit.threshold,
      feather: edit.feather,
    });

    onPreviewReady(result);
  }, [enabled, bitmap, mask, edit, onPreviewReady]);

  const handleRemoveBackground = useCallback(async () => {
    if (!bitmap) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setError(null);
    setProcessingState("loading");

    try {
      const loaded = isModelLoaded();

      if (!loaded) {
        const success = await loadModel(edit.modelId as SegmentationModelId, (progress) => {
          setLoadingProgress(progress);
        });

        if (!success) {
          throw new Error("Failed to load segmentation model");
        }
      }

      if (signal.aborted) return;

      setProcessingState("processing");

      const result: SegmentationResult = await segment(bitmap, signal);

      if (signal.aborted) return;

      if (result.ok) {
        setMask(result.mask);
        onChange({
          ...edit,
          enabled: true,
          modelId: result.modelId,
          modelVersion: result.modelVersion,
        });
        setProcessingState("ready");
      } else {
        throw new Error(result.message || "Segmentation failed");
      }
    } catch (err) {
      if (!signal.aborted) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setProcessingState("error");
      }
    }
  }, [bitmap, edit, onChange]);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setProcessingState("idle");
  }, []);

  const handleReset = useCallback(() => {
    setMask(null);
    setError(null);
    setProcessingState("idle");
    onChange(DEFAULT_BACKGROUND_REMOVAL);
    onPreviewReady(null);
  }, [onChange, onPreviewReady]);

  const isProcessing = processingState === "loading" || processingState === "processing";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {processingState === "idle" || processingState === "error" ? (
          <button
            type="button"
            className="min-h-11 rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50"
            onClick={() => void handleRemoveBackground()}
            disabled={!bitmap}
          >
            Remove Background
          </button>
        ) : isProcessing ? (
          <button
            type="button"
            className="min-h-11 rounded-md border px-4"
            onClick={handleCancel}
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            className="min-h-11 rounded-md border px-4"
            onClick={handleReset}
          >
            Reset
          </button>
        )}
      </div>

      {isProcessing && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${processingState === "loading" ? loadingProgress : 100}%`,
                }}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {processingState === "loading" ? "Loading model..." : "Processing..."}
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {(processingState === "ready" || enabled) && (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Background Color</label>
            <ColorPicker
              value={edit.replacementColor}
              onChange={(color) => onChange({ ...edit, replacementColor: color })}
              disabled={isProcessing}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="threshold-slider" className="text-sm font-medium">
              Threshold: {edit.threshold.toFixed(2)}
            </label>
            <input
              id="threshold-slider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={edit.threshold}
              onChange={(e) =>
                onChange({ ...edit, threshold: parseFloat(e.target.value) })
              }
              disabled={isProcessing}
              className="min-h-11 w-full"
            />
            <p className="text-xs text-muted-foreground">
              Higher values keep more of the subject
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="feather-slider" className="text-sm font-medium">
              Feather: {edit.feather}px
            </label>
            <input
              id="feather-slider"
              type="range"
              min="0"
              max="20"
              step="1"
              value={edit.feather}
              onChange={(e) =>
                onChange({ ...edit, feather: parseInt(e.target.value, 10) })
              }
              disabled={isProcessing}
              className="min-h-11 w-full"
            />
            <p className="text-xs text-muted-foreground">
              Softens the edges between subject and background
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            The original photograph is unchanged. Background removal is applied only to
            exports.
          </p>
        </>
      )}

      {processingState === "idle" && !enabled && (
        <p className="text-sm text-muted-foreground">
          Background removal detects the subject and replaces the background with a
          solid color. The original photograph stays unchanged.
        </p>
      )}
    </div>
  );
}
