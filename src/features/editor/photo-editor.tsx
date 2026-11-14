"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  finalizeDerivativeAction,
  prepareDerivativeAction,
  saveRevisionAction,
} from "@/features/editor/actions";
import { renderEditBlob } from "@/features/editor/export-image";
import { BackgroundTool } from "@/features/editor/background-tool";
import type { RenderBackgroundResult } from "@/features/editor/background-renderer";
import { commitHistory, createHistory, redoHistory, undoHistory, type History } from "@/features/editor/history";
import { cropForAspect } from "@/features/editor/layout";
import { recordSuggestionAction } from "@/features/photo-intelligence/actions";
import { FramingSuggestion } from "@/features/photo-intelligence/framing/framing-suggestion";
import { FRAMING_VERSION, suggestFraming, type FaceBox } from "@/features/photo-intelligence/framing/suggest";
import { estimateBackground, SEGMENTATION_VERSION } from "@/features/photo-intelligence/segmentation/estimate";
import { SegmentationOptIn } from "@/features/photo-intelligence/segmentation/segmentation-opt-in";
import {
  canvasBackgrounds,
  emptyEdit,
  frameAspects,
  type EditDocument,
  type PrivacyMask,
} from "@/features/editor/schema";

type Tool = "masks" | "crop" | "rotate" | "canvas" | "background";

const tools: Tool[] = ["masks", "crop", "rotate", "canvas", "background"];

const toolLabel: Record<Tool, string> = {
  masks: "Privacy bars",
  crop: "Crop",
  rotate: "Rotate",
  canvas: "Canvas",
  background: "Background",
};

const backgroundLabel: Record<(typeof canvasBackgrounds)[number], string> = {
  original: "Original bounds",
  "#FFFFFF": "White",
  "#E6E6E6": "Light gray",
  "#000000": "Black",
};

export function PhotoEditor({
  photoId,
  angleName,
  signedUrl,
  backHref,
  initialEdit,
  initialRevisionId,
  face,
  segmentationAvailable,
}: {
  photoId: string;
  angleName: string;
  signedUrl: string;
  backHref: string;
  initialEdit: EditDocument | null;
  initialRevisionId: string | null;
  face: FaceBox;
  segmentationAvailable: boolean;
}) {
  const router = useRouter();
  const imageRef = useRef<HTMLImageElement>(null);
  const gestureStart = useRef<EditDocument | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [history, setHistory] = useState<History<EditDocument>>(() => createHistory(initialEdit ?? emptyEdit()));
  const [saved, setSaved] = useState(JSON.stringify(initialEdit ?? emptyEdit()));
  const [revisionId, setRevisionId] = useState(initialRevisionId);
  const [tool, setTool] = useState<Tool>("masks");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [message, setMessage] = useState("");
  const [segmentationOn, setSegmentationOn] = useState(false);
  const [segmentationNote, setSegmentationNote] = useState("");
  const [backgroundPreview, setBackgroundPreview] = useState<RenderBackgroundResult | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const framing = suggestFraming(face);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const edit = history.present;
  const dirty = JSON.stringify(edit) !== saved;

  useEffect(() => {
    let active = true;
    fetch(signedUrl)
      .then((response) => response.blob())
      .then((blob) => createImageBitmap(blob))
      .then((next) => {
        if (active) setBitmap(next);
      })
      .catch(() => {
        if (active) setError("The photograph could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [signedUrl]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update(next: EditDocument, recordHistory = true) {
    setHistory((current) => (recordHistory ? commitHistory(current, next) : { ...current, present: next }));
    setShowOriginal(false);
  }

  function patch(recipe: (current: EditDocument) => EditDocument, recordHistory = true) {
    update(recipe(edit), recordHistory);
  }

  const selected = edit.privacyMasks.find((mask) => mask.id === selectedId) ?? null;

  function changeMask(id: string, recipe: (mask: PrivacyMask) => PrivacyMask, recordHistory = true) {
    patch(
      (current) => ({
        ...current,
        privacyMasks: current.privacyMasks.map((mask) => (mask.id === id ? recipe(mask) : mask)),
      }),
      recordHistory,
    );
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const result = await saveRevisionAction({ photoId, edit });
      setMessage(result.message);
      if (result.ok) {
        setSaved(JSON.stringify(edit));
        setRevisionId(result.revisionId);
        router.refresh();
      }
      return result.ok ? result.revisionId : null;
    } catch {
      setMessage("The edit could not be saved.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function exportImage(mimeType: "image/jpeg" | "image/png") {
    if (!bitmap) return;
    setBusy(true);
    setMessage("");
    try {
      const currentRevision = dirty || !revisionId ? await save() : revisionId;
      if (!currentRevision) return;
      const rendered = await renderEditBlob(exportSource(bitmap, edit, backgroundPreview), edit, mimeType);
      const url = URL.createObjectURL(rendered.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `presentation-edit.${mimeType === "image/png" ? "png" : "jpg"}`;
      anchor.click();
      URL.revokeObjectURL(url);
      const prepared = await prepareDerivativeAction({
        photoId,
        revisionId: currentRevision,
        mimeType,
        width: rendered.width,
        height: rendered.height,
        fileSize: rendered.blob.size,
      });
      if (!prepared.ok) {
        setMessage(prepared.message);
        return;
      }
      const uploaded = await createClient()
        .storage.from("photo-derivatives")
        .upload(prepared.storagePath, rendered.blob, { contentType: mimeType, upsert: false });
      if (uploaded.error) {
        setMessage("The download is ready, but the clinic copy could not be stored.");
        return;
      }
      const stored = await finalizeDerivativeAction({
        photoId,
        revisionId: currentRevision,
        mimeType,
        width: rendered.width,
        height: rendered.height,
        fileSize: rendered.blob.size,
        derivativeId: prepared.derivativeId,
        storagePath: prepared.storagePath,
      });
      setMessage(stored.message);
    } catch {
      setMessage("The export could not be prepared.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !backgroundPreview || showOriginal) return;
    canvas.width = backgroundPreview.width;
    canvas.height = backgroundPreview.height;
    canvas.getContext("2d")?.putImageData(backgroundPreview.imageData, 0, 0);
  }, [backgroundPreview, showOriginal]);

  const showBackground = Boolean(backgroundPreview && edit.backgroundRemoval.enabled && !showOriginal);
  const stageBackground = edit.canvas.background === "original" ? "#E6E6E6" : edit.canvas.background;
  const display = showOriginal ? emptyEdit() : edit;

  return (
    <section className="flex min-h-[70vh] flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center rounded-md px-3 font-medium"
          onClick={(event) => {
            if (dirty && !window.confirm("Leave without saving this edit?")) event.preventDefault();
          }}
        >
          Back
        </Link>
        <h1 className="text-xl font-semibold">{angleName}</h1>
        <button type="button" className="ml-auto min-h-11 rounded-md px-3" disabled={history.past.length === 0} onClick={() => setHistory(undoHistory)}>
          Undo
        </button>
        <button type="button" className="min-h-11 rounded-md px-3" disabled={history.future.length === 0} onClick={() => setHistory(redoHistory)}>
          Redo
        </button>
        <button type="button" className="min-h-11 rounded-md bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50" disabled={busy} onClick={() => void save()}>
          Save
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <div
        className="relative min-h-80 flex-1 overflow-hidden rounded-xl"
        style={{ background: stageBackground, touchAction: "none", padding: display.canvas.padding }}
        onDoubleClick={() => patch((current) => ({ ...current, view: { zoom: 1, panX: 0, panY: 0 } }))}
      >
        <div
          className="mx-auto h-full max-h-[70vh]"
          style={{
            transform: `translate(${display.view.panX * 40}%, ${display.view.panY * 40}%) scale(${display.view.zoom}) rotate(${display.image.rotation}deg)`,
            transformOrigin: "center",
          }}
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest("button")) return;
            gestureStart.current = edit;
            const startX = event.clientX;
            const startY = event.clientY;
            const panX = edit.view.panX;
            const panY = edit.view.panY;
            const move = (next: PointerEvent) => {
              patch(
                (current) => ({
                  ...current,
                  view: {
                    ...current.view,
                    panX: Math.max(-2, Math.min(2, panX + (next.clientX - startX) / 200)),
                    panY: Math.max(-2, Math.min(2, panY + (next.clientY - startY) / 200)),
                  },
                }),
                false,
              );
            };
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
              const start = gestureStart.current;
              if (start) {
                setHistory((current) => commitHistory({ ...current, present: start }, current.present));
              }
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        >
          {/* The photograph is loaded into a bitmap for export. This element is the editing surface. */}
          {/* The editing surface uses the signed original. next/image would resize it and hide the element used for pointer mapping. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={signedUrl}
            alt={angleName}
            className={`mx-auto max-h-[70vh] w-full object-contain ${showBackground ? "hidden" : ""}`}
            draggable={false}
          />
          <canvas
            ref={previewCanvasRef}
            aria-label={`${angleName} with the selected background`}
            className={`mx-auto max-h-[70vh] w-full object-contain ${showBackground ? "" : "hidden"}`}
          />
          <div className="pointer-events-none absolute inset-0">
            {display.privacyMasks.map((mask) => (
              <button
                key={mask.id}
                type="button"
                aria-label={mask.fill === "#000000" ? "Black privacy bar" : "White privacy bar"}
                aria-pressed={mask.id === selectedId}
                className="pointer-events-auto absolute border-2 border-primary"
                style={{
                  left: `${mask.x * 100}%`,
                  top: `${mask.y * 100}%`,
                  width: `${mask.width * 100}%`,
                  height: `${mask.height * 100}%`,
                  background: mask.fill,
                  transform: `rotate(${mask.rotation}deg)`,
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelectedId(mask.id);
                  const startX = event.clientX;
                  const startY = event.clientY;
                  const origin = mask;
                  const move = (next: PointerEvent) => {
                    const bounds = (showBackground ? previewCanvasRef.current : imageRef.current)?.getBoundingClientRect();
                    if (!bounds) return;
                    changeMask(
                      origin.id,
                      (item) => ({
                        ...item,
                        x: Math.max(0, Math.min(1 - item.width, origin.x + (next.clientX - startX) / bounds.width)),
                        y: Math.max(0, Math.min(1 - item.height, origin.y + (next.clientY - startY) / bounds.height)),
                      }),
                      false,
                    );
                  };
                  const up = () => {
                    window.removeEventListener("pointermove", move);
                    window.removeEventListener("pointerup", up);
                    const start = gestureStart.current;
                    if (start) setHistory((current) => commitHistory({ ...current, present: start }, current.present));
                  };
                  gestureStart.current = edit;
                  window.addEventListener("pointermove", move);
                  window.addEventListener("pointerup", up);
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 lg:hidden" role="group" aria-label="Editing tools">
        {tools.map((item) => (
          <button key={item} type="button" aria-pressed={tool === item} className="min-h-11 rounded-md border px-3" onClick={() => setTool(item)}>
            {toolLabel[item]}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-3">
          {tool === "masks" ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="min-h-11 rounded-md border px-3" onClick={() => addMask("#000000")}>Add black bar</button>
                <button type="button" className="min-h-11 rounded-md border px-3" onClick={() => addMask("#FFFFFF")}>Add white bar</button>
                <button type="button" className="min-h-11 rounded-md border px-3" disabled={!selected} onClick={() => selected && patch((current) => ({ ...current, privacyMasks: current.privacyMasks.filter((mask) => mask.id !== selected.id) }))}>Delete bar</button>
              </div>
              {selected ? (
                <fieldset className="grid gap-3 sm:grid-cols-2">
                  <legend className="font-medium">Selected privacy bar</legend>
                  <SizeControl label="Width" value={selected.width} min={0.05} max={1} onChange={(width) => changeMask(selected.id, (mask) => ({ ...mask, width }))} />
                  <SizeControl label="Height" value={selected.height} min={0.02} max={1} onChange={(height) => changeMask(selected.id, (mask) => ({ ...mask, height }))} />
                  <SizeControl label="Bar rotation" value={selected.rotation} min={-180} max={180} onChange={(rotation) => changeMask(selected.id, (mask) => ({ ...mask, rotation }))} />
                </fieldset>
              ) : <p className="text-sm text-muted-foreground">Add a bar, then drag it. These bars hide pixels only in an export.</p>}
            </>
          ) : null}
          {tool === "crop" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Crop aspect ratio">
                {frameAspects.map((aspect) => (
                  <button key={aspect} type="button" aria-pressed={edit.crop.aspect === aspect} className="min-h-11 rounded-md border px-3" onClick={() => bitmap && patch((current) => ({ ...current, crop: cropForAspect(bitmap.width, bitmap.height, current.image.rotation, aspect) }))}>{aspect}</button>
                ))}
              </div>
              <FramingSuggestion
                suggestion={framing}
                onAccept={(crop) => {
                  patch((current) => ({ ...current, crop }));
                  void recordSuggestionAction({
                    kind: "framing",
                    status: "accepted",
                    heuristicVersion: FRAMING_VERSION,
                    modelId: null,
                    confidence: framing.ok ? framing.confidence : null,
                    photoId,
                    payload: { x: crop.x, y: crop.y, width: crop.width, height: crop.height },
                  });
                }}
                onReject={() => {
                  void recordSuggestionAction({
                    kind: "framing",
                    status: "rejected",
                    heuristicVersion: FRAMING_VERSION,
                    modelId: null,
                    confidence: null,
                    photoId,
                    payload: { kept: true },
                  });
                }}
              />
            </div>
          ) : null}
          {tool === "rotate" ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="min-h-11 rounded-md border px-3" onClick={() => patch((current) => ({ ...current, image: { rotation: current.image.rotation - 90 } }))}>Rotate left</button>
              <button type="button" className="min-h-11 rounded-md border px-3" onClick={() => patch((current) => ({ ...current, image: { rotation: current.image.rotation + 90 } }))}>Rotate right</button>
              <button type="button" className="min-h-11 rounded-md border px-3" onClick={() => patch((current) => ({ ...current, image: { rotation: 0 } }))}>Reset rotation</button>
              <SizeControl label="Fine rotation" value={fineRotation(edit.image.rotation)} min={-20} max={20} onChange={(fine) => patch((current) => ({ ...current, image: { rotation: Math.round(current.image.rotation / 90) * 90 + fine } }))} />
            </div>
          ) : null}
          {tool === "background" ? (
            <BackgroundTool
              enabled={edit.backgroundRemoval.enabled}
              edit={edit.backgroundRemoval}
              bitmap={bitmap}
              onChange={(next) =>
                patch((current) => ({
                  ...current,
                  backgroundRemoval: {
                    enabled: next.enabled,
                    modelId: next.modelId,
                    modelVersion: next.modelVersion,
                    threshold: next.threshold,
                    feather: next.feather,
                    replacementColor: next.replacementColor,
                  },
                }))
              }
              onPreviewReady={setBackgroundPreview}
            />
          ) : null}
          {tool === "canvas" ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Canvas background">
                {canvasBackgrounds.map((color) => (
                  <button key={color} type="button" aria-pressed={edit.canvas.background === color} className="min-h-11 rounded-md border px-3" onClick={() => patch((current) => ({ ...current, canvas: { ...current.canvas, background: color } }))}>{backgroundLabel[color]}</button>
                ))}
              </div>
              <SizeControl label="Padding" value={edit.canvas.padding} min={0} max={200} onChange={(padding) => patch((current) => ({ ...current, canvas: { ...current.canvas, padding } }))} />
            </div>
          ) : null}
          <SizeControl label="Zoom" value={edit.view.zoom} min={1} max={3} step={0.01} onChange={(zoom) => patch((current) => ({ ...current, view: { ...current.view, zoom } }))} />
          <button type="button" className="min-h-11 self-start rounded-md border px-3" onClick={() => patch((current) => ({ ...current, view: { zoom: 1, panX: 0, panY: 0 } }))}>Reset zoom</button>
          {segmentationAvailable ? (
            <div className="flex flex-col gap-2">
              <SegmentationOptIn
                enabled={segmentationOn}
                onChange={(next) => {
                  setSegmentationOn(next);
                  if (!next || !bitmap) {
                    setSegmentationNote("");
                    return;
                  }
                  const estimate = coverageFor(bitmap);
                  setSegmentationNote(
                    estimate.ok
                      ? "A presentation estimate is available. The original photograph stays unchanged."
                      : "The background could not be separated. The original photograph stays unchanged.",
                  );
                  void recordSuggestionAction({
                    kind: "segmentation",
                    status: estimate.ok ? "accepted" : "rejected",
                    heuristicVersion: SEGMENTATION_VERSION,
                    modelId: null,
                    confidence: estimate.ok ? estimate.coverage : null,
                    photoId,
                    payload: estimate.ok ? { coverage: Number(estimate.coverage.toFixed(3)) } : { reason: estimate.reason },
                  });
                }}
              />
              {segmentationNote ? <p className="text-base">{segmentationNote}</p> : null}
            </div>
          ) : null}
          <button
            type="button"
            className="min-h-11 self-start rounded-md border px-3"
            aria-pressed={showOriginal}
            onPointerDown={() => setShowOriginal(true)}
            onPointerUp={() => setShowOriginal(false)}
            onPointerLeave={() => setShowOriginal(false)}
            onClick={() => setShowOriginal((current) => !current)}
          >
            {showOriginal ? "Showing original" : "Show original"}
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="min-h-11 rounded-md border px-3" disabled={busy || !bitmap} onClick={() => void exportImage("image/jpeg")}>Download JPEG</button>
            <button type="button" className="min-h-11 rounded-md border px-3" disabled={busy || !bitmap} onClick={() => void exportImage("image/png")}>Download PNG</button>
          </div>
          <p role="status" className="text-sm">{message}</p>
          <p className="text-sm text-muted-foreground">A privacy bar is not complete anonymization. A recognizable face may still identify a person. The original clinical photograph is never replaced.</p>
        </div>
        <div className="hidden flex-col gap-2 lg:flex" role="group" aria-label="Editing tools">
          {tools.map((item) => (
            <button key={item} type="button" aria-pressed={tool === item} className="min-h-11 rounded-md border px-3 text-left" onClick={() => setTool(item)}>{toolLabel[item]}</button>
          ))}
        </div>
      </div>
    </section>
  );

  function addMask(fill: PrivacyMask["fill"]) {
    const id = crypto.randomUUID();
    patch((current) => ({
      ...current,
      privacyMasks: [
        ...current.privacyMasks,
        { id, type: "rectangle", fill, x: 0.28, y: 0.32, width: 0.44, height: 0.08, rotation: 0, order: current.privacyMasks.length },
      ],
    }));
    setSelectedId(id);
  }
}

function exportSource(
  bitmap: ImageBitmap,
  edit: EditDocument,
  preview: RenderBackgroundResult | null,
): CanvasImageSource & { width: number; height: number } {
  if (!edit.backgroundRemoval.enabled || !preview) return bitmap;
  const canvas = document.createElement("canvas");
  canvas.width = preview.width;
  canvas.height = preview.height;
  const context = canvas.getContext("2d");
  if (!context) return bitmap;
  context.putImageData(preview.imageData, 0, 0);
  return canvas;
}

function fineRotation(rotation: number) {
  const nearest = Math.round(rotation / 90) * 90;
  return Math.max(-20, Math.min(20, rotation - nearest));
}

function coverageFor(bitmap: ImageBitmap) {
  const canvas = document.createElement("canvas");
  const longest = Math.max(bitmap.width, bitmap.height, 1);
  const scale = Math.min(1, 160 / longest);
  canvas.width = Math.max(8, Math.round(bitmap.width * scale));
  canvas.height = Math.max(8, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return { ok: false as const, reason: "poor_separation" as const };
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return estimateBackground({ width: canvas.width, height: canvas.height, rgba: image.data });
}

function SizeControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return (
    <label htmlFor={id} className="text-sm font-medium">
      {label}: {Number(value.toFixed(2))}
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="min-h-11 w-full" />
    </label>
  );
}
