"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crop, Eye, RectangleHorizontal, RotateCw, Sparkles } from "lucide-react";
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
import { moveCrop, pinchView, resizeCrop, resizeMask } from "@/features/editor/gestures";
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

type Tool = "look" | "crop" | "rotate" | "cover" | "background";

const tools: Tool[] = ["look", "crop", "rotate", "cover", "background"];

const toolLabel: Record<Tool, string> = {
  look: "Look",
  crop: "Crop",
  rotate: "Rotate",
  cover: "Cover",
  background: "Background",
};

const toolIcon: Record<Tool, typeof Eye> = {
  look: Eye,
  crop: Crop,
  rotate: RotateCw,
  cover: RectangleHorizontal,
  background: Sparkles,
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
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; view: EditDocument["view"]; midX: number; midY: number; origin: EditDocument } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [history, setHistory] = useState<History<EditDocument>>(() => createHistory(initialEdit ?? emptyEdit()));
  const [saved, setSaved] = useState(JSON.stringify(initialEdit ?? emptyEdit()));
  const [revisionId, setRevisionId] = useState(initialRevisionId);
  const [tool, setTool] = useState<Tool>("look");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [activity, setActivity] = useState<{ label: string; progress: number } | null>(null);
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

  const reportActivity = useCallback((next: { label: string; progress: number } | null) => {
    setActivity((current) => {
      if (!next && !current) return current;
      if (next && current && next.label === current.label && next.progress === current.progress) return current;
      return next;
    });
  }, []);

  function clearHold() {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function stagePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointers.current.size >= 2) {
      clearHold();
      setShowOriginal(false);
      const [first, second] = [...pointers.current.values()];
      pinch.current = {
        distance: Math.hypot(first.x - second.x, first.y - second.y),
        view: edit.view,
        midX: (first.x + second.x) / 2,
        midY: (first.y + second.y) / 2,
        origin: edit,
      };
      return;
    }
    if (tool !== "look") return;
    clearHold();
    holdTimer.current = setTimeout(() => setShowOriginal(true), 180);
  }

  function stagePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size < 2) {
      if (Math.hypot(event.clientX - previous.x, event.clientY - previous.y) > 12) {
        clearHold();
        setShowOriginal(false);
      }
      return;
    }
    const active = pinch.current;
    if (!active) return;
    const [first, second] = [...pointers.current.values()];
    const view = pinchView(
      active.view,
      active.distance,
      Math.hypot(first.x - second.x, first.y - second.y),
      (first.x + second.x) / 2 - active.midX,
      (first.y + second.y) / 2 - active.midY,
    );
    setHistory((current) => ({ ...current, present: { ...current.present, view } }));
  }

  function stagePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    clearHold();
    if (tool === "look") setShowOriginal(false);
    const active = pinch.current;
    if (pointers.current.size >= 2 || !active) return;
    pinch.current = null;
    setHistory((current) =>
      JSON.stringify(current.present.view) === JSON.stringify(active.view)
        ? current
        : commitHistory({ ...current, present: { ...active.origin, view: active.view } }, current.present),
    );
  }

  function startCropDrag(event: ReactPointerEvent, mode: "move" | "resize") {
    event.stopPropagation();
    const bounds = imageRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) return;
    const origin = edit.crop;
    const startX = event.clientX;
    const startY = event.clientY;
    const before = edit;
    const move = (next: PointerEvent) => {
      const dx = (next.clientX - startX) / bounds.width;
      const dy = (next.clientY - startY) / bounds.height;
      const crop = mode === "move" ? moveCrop(origin, dx, dy) : resizeCrop(origin, dx, dy);
      setHistory((current) => ({ ...current, present: { ...current.present, crop } }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setHistory((current) =>
        JSON.stringify(current.present.crop) === JSON.stringify(before.crop)
          ? current
          : commitHistory({ ...current, present: before }, current.present),
      );
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const showBackground = Boolean(backgroundPreview && edit.backgroundRemoval.enabled && !showOriginal);
  const stageBackground = edit.canvas.background === "original" ? "#E6E6E6" : edit.canvas.background;
  const display = showOriginal ? emptyEdit() : edit;
  const canDownload = Boolean(bitmap) && !dirty && Boolean(revisionId) && !busy;
  const sheetOpen = tool !== "look" || optionsOpen;

  return (
    <section className="fixed inset-x-0 top-20 bottom-16 z-10 flex flex-col gap-3 overflow-hidden bg-background px-3 pt-2 lg:static lg:inset-auto lg:z-auto lg:grid lg:h-auto lg:min-h-[calc(100dvh-8rem)] lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-4 lg:overflow-visible lg:bg-transparent lg:px-0 lg:pt-0">
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center rounded-md px-3 text-base font-medium"
            onClick={(event) => {
              if (dirty && !window.confirm("Leave without saving this edit?")) event.preventDefault();
            }}
          >
            Back
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{angleName}</h1>
          <button type="button" className="min-h-11 shrink-0 rounded-md bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-50" disabled={busy} onClick={() => void save()}>
            Save
          </button>
        </div>
        {error ? <p role="alert" className="text-base">{error}</p> : null}
        {message ? <p role="status" className="text-base">{message}</p> : null}
        <div
          className="relative min-h-0 flex-1 overflow-hidden rounded-2xl ring-2 ring-primary/60"
          style={{ background: stageBackground, touchAction: "none" }}
          onDoubleClick={() => patch((current) => ({ ...current, view: { zoom: 1, panX: 0, panY: 0 } }))}
          onPointerDown={stagePointerDown}
          onPointerMove={stagePointerMove}
          onPointerUp={stagePointerEnd}
          onPointerCancel={stagePointerEnd}
        >
          <p className="pointer-events-none absolute top-3 left-3 z-10 rounded-full bg-card/95 px-3 py-1 text-sm font-medium text-primary">
            Uploaded photograph
          </p>
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            <button type="button" className="min-h-11 rounded-md bg-card/95 px-3 text-base font-medium disabled:opacity-40" disabled={history.past.length === 0} onClick={() => setHistory(undoHistory)}>
              Undo
            </button>
            <button type="button" className="min-h-11 rounded-md bg-card/95 px-3 text-base font-medium disabled:opacity-40" disabled={history.future.length === 0} onClick={() => setHistory(redoHistory)}>
              Redo
            </button>
          </div>
          <div
            className="mx-auto h-full"
            style={{
              transform: `translate(${display.view.panX * 40}%, ${display.view.panY * 40}%) scale(${display.view.zoom}) rotate(${display.image.rotation}deg)`,
              transformOrigin: "center",
              padding: display.canvas.padding,
            }}
          >
            <div className="relative mx-auto h-full w-full">
              {/* The photograph is loaded into a bitmap for export. This element is the editing surface. */}
              {/* The editing surface uses the signed original. next/image would resize it and hide the element used for pointer mapping. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imageRef}
                src={signedUrl}
                alt={angleName}
                className={`mx-auto block h-full max-h-full w-full object-contain ${showBackground ? "hidden" : ""}`}
                draggable={false}
              />
              {showBackground ? null : (
                <CropFrame crop={display.crop} imageRef={imageRef} interactive={tool === "crop"} onDrag={startCropDrag} />
              )}
            </div>
            <canvas
              ref={previewCanvasRef}
              aria-label={`${angleName} with the selected background`}
              className={`mx-auto h-full max-h-full w-full object-contain ${showBackground ? "" : "hidden"}`}
            />
            <div className="pointer-events-none absolute inset-0">
              {display.privacyMasks.map((mask) => (
                <div
                  key={mask.id}
                  className="pointer-events-none absolute"
                  style={{
                    left: `${mask.x * 100}%`,
                    top: `${mask.y * 100}%`,
                    width: `${mask.width * 100}%`,
                    height: `${mask.height * 100}%`,
                    transform: `rotate(${mask.rotation}deg)`,
                  }}
                >
                  <button
                    type="button"
                    aria-label={mask.fill === "#000000" ? "Black privacy bar" : "White privacy bar"}
                    aria-pressed={mask.id === selectedId}
                    className="pointer-events-auto absolute inset-0 border-2 border-primary"
                    style={{ background: mask.fill }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setSelectedId(mask.id);
                      const startX = event.clientX;
                      const startY = event.clientY;
                      const origin = mask;
                      const before = edit;
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
                        setHistory((current) => commitHistory({ ...current, present: before }, current.present));
                      };
                      window.addEventListener("pointermove", move);
                      window.addEventListener("pointerup", up);
                    }}
                  />
                  {tool === "cover" && mask.id === selectedId ? (
                    <button
                      type="button"
                      aria-label="Resize privacy bar"
                      className="pointer-events-auto absolute -right-3 -bottom-3 z-10 size-11 rounded-full border-2 border-primary bg-card"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        const bounds = (showBackground ? previewCanvasRef.current : imageRef.current)?.getBoundingClientRect();
                        if (!bounds) return;
                        const origin = mask;
                        const before = edit;
                        const startX = event.clientX;
                        const startY = event.clientY;
                        const move = (next: PointerEvent) => {
                          const nextSize = resizeMask(
                            origin,
                            (next.clientX - startX) / bounds.width,
                            (next.clientY - startY) / bounds.height,
                          );
                          changeMask(origin.id, (item) => ({ ...item, ...nextSize }), false);
                        };
                        const up = () => {
                          window.removeEventListener("pointermove", move);
                          window.removeEventListener("pointerup", up);
                          setHistory((current) => commitHistory({ ...current, present: before }, current.present));
                        };
                        window.addEventListener("pointermove", move);
                        window.addEventListener("pointerup", up);
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          {activity ? (
            <div className="absolute inset-x-4 bottom-4 z-10 rounded-xl bg-card/95 p-3">
              <p className="text-base">{activity.label}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${activity.progress}%` }} />
              </div>
            </div>
          ) : null}
          {edit.view.zoom !== 1 ? (
            <button
              type="button"
              className="absolute bottom-3 left-3 z-10 min-h-11 rounded-md bg-card/95 px-3 text-base font-medium"
              onClick={() => patch((current) => ({ ...current, view: { zoom: 1, panX: 0, panY: 0 } }))}
            >
              Reset zoom
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {tool === "look" && !optionsOpen ? (
          <button type="button" className="min-h-11 w-full rounded-xl border bg-card px-3 text-base font-medium" onClick={() => setOptionsOpen(true)}>
            Photograph options
          </button>
        ) : null}
        {sheetOpen ? (
          <div className="flex max-h-[34dvh] flex-col gap-3 overflow-y-auto rounded-2xl bg-card p-3 ring-1 ring-foreground/10 lg:max-h-[calc(100dvh-16rem)]">
            {tool === "look" ? (
              <div className="flex flex-col gap-3">
                <button type="button" className="min-h-11 self-start rounded-md px-3 text-base font-medium" onClick={() => setOptionsOpen(false)}>
                  Close options
                </button>
                <button
                  type="button"
                  className="min-h-11 self-start rounded-md border px-3 text-base"
                  aria-pressed={showOriginal}
                  onPointerDown={() => setShowOriginal(true)}
                  onPointerUp={() => setShowOriginal(false)}
                  onPointerLeave={() => setShowOriginal(false)}
                  onClick={(event) => {
                    if (event.detail !== 0) return;
                    setShowOriginal((current) => !current);
                  }}
                >
                  {showOriginal ? "Showing original" : "Show original"}
                </button>
                <p className="text-base text-muted-foreground">Press and hold the photograph to compare it with the original.</p>
                <SizeControl label="Zoom" value={edit.view.zoom} min={1} max={3} step={0.01} onChange={(zoom) => patch((current) => ({ ...current, view: { ...current.view, zoom } }))} />
                <button type="button" className="min-h-11 self-start rounded-md border px-3 text-base" onClick={() => patch((current) => ({ ...current, view: { zoom: 1, panX: 0, panY: 0 } }))}>Reset zoom</button>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Canvas background">
                  {canvasBackgrounds.map((color) => (
                    <button key={color} type="button" aria-pressed={edit.canvas.background === color} className="min-h-11 rounded-md border px-3 text-base" onClick={() => patch((current) => ({ ...current, canvas: { ...current.canvas, background: color } }))}>{backgroundLabel[color]}</button>
                  ))}
                </div>
                <SizeControl label="Padding" value={edit.canvas.padding} min={0} max={200} onChange={(padding) => patch((current) => ({ ...current, canvas: { ...current.canvas, padding } }))} />
                <div className="flex flex-col gap-2">
                  <button type="button" className="min-h-11 rounded-md border px-3 text-base" disabled={!canDownload} onClick={() => void exportImage("image/jpeg")}>Download JPEG</button>
                  <button type="button" className="min-h-11 rounded-md border px-3 text-base" disabled={!canDownload} onClick={() => void exportImage("image/png")}>Download PNG</button>
                  {canDownload ? null : <p className="text-base text-muted-foreground">Save the edit, then download it.</p>}
                </div>
              </div>
            ) : null}
            {tool === "cover" ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="min-h-11 rounded-md border px-3 text-base" onClick={() => addMask("#000000")}>Add black bar</button>
                  <button type="button" className="min-h-11 rounded-md border px-3 text-base" onClick={() => addMask("#FFFFFF")}>Add white bar</button>
                  <button type="button" className="min-h-11 rounded-md border px-3 text-base" disabled={!selected} onClick={() => selected && patch((current) => ({ ...current, privacyMasks: current.privacyMasks.filter((mask) => mask.id !== selected.id) }))}>Delete bar</button>
                </div>
                {selected ? (
                  <fieldset className="grid gap-3">
                    <legend className="text-base font-medium">Selected privacy bar</legend>
                    <SizeControl label="Width" value={selected.width} min={0.05} max={1} step={0.01} onChange={(width) => changeMask(selected.id, (mask) => ({ ...mask, width }))} />
                    <SizeControl label="Height" value={selected.height} min={0.02} max={1} step={0.01} onChange={(height) => changeMask(selected.id, (mask) => ({ ...mask, height }))} />
                    <SizeControl label="Bar rotation" value={selected.rotation} min={-180} max={180} onChange={(rotation) => changeMask(selected.id, (mask) => ({ ...mask, rotation }))} />
                  </fieldset>
                ) : <p className="text-base text-muted-foreground">Add a bar, then drag it. Drag the round handle to resize it. These bars hide pixels only in an export.</p>}
                <p className="text-base text-muted-foreground">A privacy bar is not complete anonymization. A recognizable face may still identify a person. The original clinical photograph is never replaced.</p>
              </>
            ) : null}
            {tool === "crop" ? (
              <div className="flex flex-col gap-3">
                <p className="text-base text-muted-foreground">Drag the frame on the photograph. Drag its corner to resize it.</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Crop aspect ratio">
                  {frameAspects.map((aspect) => (
                    <button key={aspect} type="button" aria-pressed={edit.crop.aspect === aspect} className="min-h-11 rounded-md border px-3 text-base" onClick={() => bitmap && patch((current) => ({ ...current, crop: cropForAspect(bitmap.width, bitmap.height, current.image.rotation, aspect) }))}>{aspect}</button>
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
                <button type="button" className="min-h-11 rounded-md border px-3 text-base" onClick={() => patch((current) => ({ ...current, image: { rotation: current.image.rotation - 90 } }))}>Rotate left</button>
                <button type="button" className="min-h-11 rounded-md border px-3 text-base" onClick={() => patch((current) => ({ ...current, image: { rotation: current.image.rotation + 90 } }))}>Rotate right</button>
                <button type="button" className="min-h-11 rounded-md border px-3 text-base" onClick={() => patch((current) => ({ ...current, image: { rotation: 0 } }))}>Reset rotation</button>
                <SizeControl label="Fine rotation" value={fineRotation(edit.image.rotation)} min={-20} max={20} onChange={(fine) => patch((current) => ({ ...current, image: { rotation: Math.round(current.image.rotation / 90) * 90 + fine } }))} />
              </div>
            ) : null}
            {tool === "background" ? (
              <>
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
                  onActivity={reportActivity}
                />
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
              </>
            ) : null}
          </div>
        ) : null}
        <div className="grid grid-cols-5 gap-1 rounded-2xl bg-card p-1 ring-1 ring-foreground/10" role="group" aria-label="Editing tools">
          {tools.map((item) => {
            const Icon = toolIcon[item];
            return (
              <button
                key={item}
                type="button"
                aria-pressed={tool === item}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-medium ${tool === item ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                onClick={() => {
                  setTool(item);
                  if (item !== "look") setOptionsOpen(false);
                }}
              >
                <Icon aria-hidden="true" className="size-5" />
                {toolLabel[item]}
              </button>
            );
          })}
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

function cropCoversPhotograph(crop: EditDocument["crop"]) {
  return crop.x <= 0.001 && crop.y <= 0.001 && crop.width >= 0.999 && crop.height >= 0.999;
}

function CropFrame({
  crop,
  imageRef,
  interactive,
  onDrag,
}: {
  crop: EditDocument["crop"];
  imageRef: RefObject<HTMLImageElement | null>;
  interactive: boolean;
  onDrag: (event: ReactPointerEvent, mode: "move" | "resize") => void;
}) {
  const [painted, setPainted] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;

    const measure = () => {
      const width = image.clientWidth;
      const height = image.clientHeight;
      const naturalWidth = image.naturalWidth;
      const naturalHeight = image.naturalHeight;
      if (width === 0 || height === 0 || naturalWidth === 0 || naturalHeight === 0) {
        setPainted(null);
        return;
      }
      const scale = Math.min(width / naturalWidth, height / naturalHeight);
      const paintedWidth = naturalWidth * scale;
      const paintedHeight = naturalHeight * scale;
      setPainted({
        left: (width - paintedWidth) / 2,
        top: (height - paintedHeight) / 2,
        width: paintedWidth,
        height: paintedHeight,
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(image);
    image.addEventListener("load", measure);
    return () => {
      observer.disconnect();
      image.removeEventListener("load", measure);
    };
  }, [imageRef]);

  if (!painted || (!interactive && cropCoversPhotograph(crop))) return null;

  const frame = {
    left: painted.left + crop.x * painted.width,
    top: painted.top + crop.y * painted.height,
    width: Math.max(0, crop.width * painted.width),
    height: Math.max(0, crop.height * painted.height),
  };
  const right = painted.left + painted.width;
  const bottom = painted.top + painted.height;
  const dim = "absolute bg-black/45";

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className={dim} style={{ left: painted.left, top: painted.top, width: painted.width, height: Math.max(0, frame.top - painted.top) }} />
      <div className={dim} style={{ left: painted.left, top: frame.top + frame.height, width: painted.width, height: Math.max(0, bottom - (frame.top + frame.height)) }} />
      <div className={dim} style={{ left: painted.left, top: frame.top, width: Math.max(0, frame.left - painted.left), height: frame.height }} />
      <div className={dim} style={{ left: frame.left + frame.width, top: frame.top, width: Math.max(0, right - (frame.left + frame.width)), height: frame.height }} />
      <div
        role="img"
        aria-label="Crop frame"
        className={`absolute border-2 border-white ring-2 ring-primary ${interactive ? "pointer-events-auto" : ""}`}
        style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
        onPointerDown={interactive ? (event) => onDrag(event, "move") : undefined}
      />
      {interactive ? (
        <button
          type="button"
          aria-label="Resize crop"
          className="pointer-events-auto absolute z-10 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-card"
          style={{ left: frame.left + frame.width, top: frame.top + frame.height }}
          onPointerDown={(event) => onDrag(event, "resize")}
        />
      ) : null}
    </div>
  );
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
    <label htmlFor={id} className="text-base font-medium">
      {label}: {Number(value.toFixed(2))}
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="min-h-11 w-full" />
    </label>
  );
}
