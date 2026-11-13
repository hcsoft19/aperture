"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelCaptureAction,
  discardPhotoAction,
  finalizePhotoAction,
  finishCaptureAction,
  preparePhotoAction,
} from "@/features/capture/actions";
import { describePhotograph, frameFromVideo, isCaptureMime } from "@/features/capture/media";
import type { CaptureSessionView } from "@/features/capture/queries";
import { createClient } from "@/lib/supabase/client";

const CHECKS = [
  { id: "guide", label: "The face matches the guide." },
  { id: "light", label: "The lighting is even." },
  { id: "expression", label: "The expression is neutral." },
] as const;

type CaptureWizardProps = {
  session: CaptureSessionView;
};

export function CaptureWizard({ session }: CaptureWizardProps) {
  const router = useRouter();
  const [savedExtra, setSavedExtra] = useState<string[]>([]);
  const saved = new Set([...session.photos.map((photo) => photo.angleId), ...savedExtra]);
  const firstOpen = session.protocol.angles.findIndex((angle) => !saved.has(angle.id));
  const [angleIndex, setAngleIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<Blob | null>(null);
  const [source, setSource] = useState<"camera" | "gallery">("camera");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const angle = session.protocol.angles[angleIndex];
  const reference = session.references.find((item) => item.angleId === angle?.id) ?? null;
  const alreadySaved = angle ? saved.has(angle.id) : false;
  const locked = session.status !== "draft";
  const uploadedCount = session.photos.length;

  useEffect(() => {
    if (locked || pendingFile) {
      return;
    }

    let cancelled = false;
    const video = videoRef.current;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraMessage("This browser cannot open a camera. You can use a saved photograph instead.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1440 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setCameraMessage(null);
      } catch {
        setCameraMessage("The camera is unavailable. Allow camera access, or use a saved photograph.");
      }
    }

    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [facing, locked, pendingFile, angleIndex]);

  function resetReview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPendingFile(null);
    setChecks({});
    setMessage(null);
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const blob = await frameFromVideo(video);
    if (!blob) {
      setMessage("The photograph could not be taken.");
      return;
    }
    const track = streamRef.current?.getVideoTracks()[0];
    const mode = track?.getSettings().facingMode;
    if (mode === "user" || mode === "environment") {
      setFacing(mode);
    }
    setSource("camera");
    setPendingFile(blob);
    setPreviewUrl(URL.createObjectURL(blob));
    setChecks({});
    setMessage(null);
  }

  async function chooseSavedPhotograph(file: File | undefined) {
    if (!file) {
      return;
    }
    if (!isCaptureMime(file.type)) {
      setMessage("Use a JPEG, PNG, or WebP photograph.");
      return;
    }
    setSource("gallery");
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setChecks({});
    setMessage(null);
  }

  async function acceptPhotograph() {
    if (!angle || !pendingFile) {
      return;
    }
    setSaving(true);
    setMessage(null);
    const details = await describePhotograph(pendingFile);
    if (!details || Math.min(details.width, details.height) < 1000) {
      setMessage("Use a photograph at least 1000 pixels on the shortest side.");
      setSaving(false);
      return;
    }

    const prepared = await preparePhotoAction({
      sessionId: session.id,
      angleId: angle.id,
      source,
      mimeType: details.mimeType,
      width: details.width,
      height: details.height,
      fileSizeBytes: details.fileSizeBytes,
      sha256: details.sha256,
      cameraFacing: source === "camera" ? facing : null,
      overlayOpacity: reference?.previewUrl ? 0.45 : null,
      referencePhotoId: reference?.id ?? null,
    });

    if (prepared.status === "error") {
      setMessage(prepared.message);
      setSaving(false);
      return;
    }

    const supabase = createClient();
    const upload = await supabase.storage.from("clinical-photos").upload(prepared.storagePath, pendingFile, {
      contentType: details.mimeType,
      upsert: false,
    });

    if (upload.error) {
      await discardPhotoAction({ sessionId: session.id, photoId: prepared.photoId });
      setMessage("The photograph could not be saved.");
      setSaving(false);
      return;
    }

    const finalized = await finalizePhotoAction({ sessionId: session.id, photoId: prepared.photoId });
    if (finalized.status === "error") {
      setMessage(finalized.message);
      setSaving(false);
      return;
    }

    setSavedExtra((current) => [...current, angle.id]);
    resetReview();
    router.refresh();
    setSaving(false);
  }

  async function finish(kind: "complete" | "cancel") {
    setSaving(true);
    setMessage(null);
    const action = kind === "complete" ? finishCaptureAction : cancelCaptureAction;
    const result = await action({ sessionId: session.id, missingReason: reason });
    if (result?.status === "error") {
      setMessage(result.message);
      setSaving(false);
    }
  }

  if (!angle) {
    return <p className="text-base text-muted-foreground">This protocol has no angles.</p>;
  }

  const savedPhoto = session.photos.find((photo) => photo.angleId === angle.id) ?? null;
  const checksComplete = CHECKS.every((item) => checks[item.id]);

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <div>
        <p className="text-sm text-muted-foreground">
          {session.patientName} · {session.treatmentName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{angle.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {session.protocol.name} version {session.protocol.version} · Angle {angleIndex + 1} of{" "}
          {session.protocol.angles.length}
        </p>
      </div>
      <p className="text-base leading-7">{angle.instructions}</p>
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <div className="relative overflow-hidden rounded-xl bg-black">
        {pendingFile && previewUrl ? (
          // The review image is a local photograph that has not been uploaded yet.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={`Review of ${angle.name}`} className="aspect-[3/4] w-full object-contain" />
        ) : savedPhoto?.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={savedPhoto.previewUrl} alt={angle.name} className="aspect-[3/4] w-full object-contain" />
        ) : (
          <video ref={videoRef} className="aspect-[3/4] w-full object-contain" playsInline muted autoPlay />
        )}
        {!pendingFile && !savedPhoto ? (
          <>
            {reference?.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={reference.previewUrl}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-45"
              />
            ) : null}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute top-[8%] left-1/2 h-[84%] w-px -translate-x-1/2 bg-white/80" />
              <div className="absolute top-1/2 left-1/2 h-[68%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-white/80" />
            </div>
          </>
        ) : null}
      </div>
      {cameraMessage && !pendingFile && !savedPhoto ? (
        <p className="text-sm text-muted-foreground" role="status">
          {cameraMessage}
        </p>
      ) : null}
      {locked || alreadySaved ? (
        <p className="text-base text-muted-foreground">
          {alreadySaved ? "This angle is saved." : "This session is closed."}
        </p>
      ) : pendingFile ? (
        <div className="flex flex-col gap-3">
          {CHECKS.map((item) => (
            <label key={item.id} className="flex min-h-11 items-center gap-3 text-base">
              <input
                type="checkbox"
                checked={Boolean(checks[item.id])}
                onChange={(event) => setChecks((current) => ({ ...current, [item.id]: event.target.checked }))}
              />
              {item.label}
            </label>
          ))}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" size="lg" variant="outline" onClick={resetReview} disabled={saving}>
              Retake
            </Button>
            <Button type="button" size="lg" onClick={() => void acceptPhotograph()} disabled={saving || !checksComplete}>
              {saving ? "Saving…" : "Use this photograph"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" size="lg" onClick={() => void captureFrame()} disabled={Boolean(cameraMessage)}>
              Capture
            </Button>
            <Button type="button" size="lg" variant="outline" onClick={() => setFacing((current) => (current === "environment" ? "user" : "environment"))}>
              Switch camera
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gallery-photo">Use a saved photograph</Label>
            <input
              id="gallery-photo"
              className="block min-h-11 w-full text-base"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => void chooseSavedPhotograph(event.target.files?.[0])}
            />
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button type="button" size="lg" variant="outline" disabled={angleIndex === 0} onClick={() => { resetReview(); setAngleIndex((current) => current - 1); }}>
          Previous
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={angleIndex >= session.protocol.angles.length - 1}
          onClick={() => { resetReview(); setAngleIndex((current) => current + 1); }}
        >
          Next angle
        </Button>
      </div>
      {!locked ? (
        <form
          className="flex flex-col gap-3 border-t border-border pt-4"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <Label htmlFor="missing-reason">Missing angles</Label>
          <Textarea
            id="missing-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Required when the series is incomplete."
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" size="lg" disabled={saving} onClick={() => void finish("complete")}>
              Finish session
            </Button>
            <Button type="button" size="lg" variant="outline" disabled={saving} onClick={() => void finish("cancel")}>
              {uploadedCount === 0 ? "Discard session" : "Cancel session"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{uploadedCount} of {session.protocol.angles.length} angles saved.</p>
        </form>
      ) : (
        <p className="text-base text-muted-foreground">
          This session is {session.status}. {uploadedCount} of {session.protocol.angles.length} angles were saved.
        </p>
      )}
    </div>
  );
}
