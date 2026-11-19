"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
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
import { assessSource } from "@/features/capture/guidance/sample";
import type { CaptureAssessment } from "@/features/capture/guidance/schema";
import { useLiveGuidance } from "@/features/capture/guidance/use-live-guidance";
import { describePhotograph, frameFromVideo, isCaptureMime, jpegFromDecodedBitmap } from "@/features/capture/media";
import { recordCaptureQualityAction, saveCaptureSettingsAction } from "@/features/capture/quality-actions";
import type { CaptureSessionView } from "@/features/capture/queries";
import { reviewSession } from "@/features/photo-intelligence/completeness/review";
import { SessionReview } from "@/features/photo-intelligence/completeness/session-review";
import { SetupSuggestions } from "@/features/photo-intelligence/setup-suggestions";
import { createClient } from "@/lib/supabase/client";

const CHECKS = [
  { id: "guide", label: "The face matches the guide." },
  { id: "light", label: "The lighting is even." },
  { id: "expression", label: "The expression is neutral." },
] as const;

type CaptureWizardProps = {
  session: CaptureSessionView;
  guidanceEnabled?: boolean;
};

export function CaptureWizard({ session, guidanceEnabled = false }: CaptureWizardProps) {
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
  const [reviewAssessment, setReviewAssessment] = useState<CaptureAssessment | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [guidanceOn, setGuidanceOn] = useState(session.guidanceEnabled);
  const [showPreviousPhotograph, setShowPreviousPhotograph] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const angle = session.protocol.angles[angleIndex];
  const reference = session.references.find((item) => item.angleId === angle?.id) ?? null;
  const alreadySaved = angle ? saved.has(angle.id) : false;
  const locked = session.status !== "draft";
  const uploadedCount = session.photos.length;
  const guidanceActive = guidanceEnabled && guidanceOn;
  const baseline = reference?.quality?.faceCenterX != null && reference.quality.faceCenterY != null && reference.quality.faceWidth != null
    ? { centerX: reference.quality.faceCenterX, centerY: reference.quality.faceCenterY, width: reference.quality.faceWidth }
    : null;
  const liveAssessment = useLiveGuidance({
    videoRef,
    enabled: guidanceActive && !locked && !pendingFile && !alreadySaved,
    angleCode: angle?.code ?? "front",
    baseline,
  });

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
    setReviewAssessment(null);
    setOverrideReason("");
    setMessage(null);
  }

  async function rememberAssessment(file: Blob) {
    if (!guidanceActive) {
      setReviewAssessment(null);
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const width = 160;
      const height = Math.max(2, Math.round((bitmap.height / Math.max(bitmap.width, 1)) * width));
      const result = await assessSource({
        source: bitmap,
        width,
        height,
        angleCode: angle?.code ?? "front",
        previous: null,
        baseline,
      });
      bitmap.close();
      setReviewAssessment(result.assessment);
    } catch {
      setReviewAssessment(null);
    }
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
    await rememberAssessment(blob);
  }

  async function chooseSavedPhotograph(file: File | undefined) {
    if (!file) {
      return;
    }

    let photograph: Blob | null = file;
    if (!isCaptureMime(file.type)) {
      photograph = file.type === "" ? await jpegFromDecodedBitmap(file) : null;
    }
    if (!photograph) {
      setMessage("Use a JPEG, PNG, or WebP photograph.");
      return;
    }

    setSource("gallery");
    setPendingFile(photograph);
    setPreviewUrl(URL.createObjectURL(photograph));
    setChecks({});
    setMessage(null);
    await rememberAssessment(photograph);
  }

  async function acceptPhotograph() {
    if (!angle || !pendingFile) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const details = await describePhotograph(pendingFile);
      if (!details) {
        setMessage("This photograph could not be read. Choose a valid JPEG, PNG, or WebP file up to 10 MB.");
        return;
      }
      if (Math.min(details.width, details.height) < 1000) {
        setMessage("Use a photograph at least 1000 pixels on the shortest side.");
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
        overlayOpacity: showPreviousPhotograph && reference?.previewUrl ? 0.45 : null,
        referencePhotoId: reference?.id ?? null,
      });

      if (prepared.status === "error") {
        setMessage(prepared.message);
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
        return;
      }

      const finalized = await finalizePhotoAction({ sessionId: session.id, photoId: prepared.photoId });
      if (finalized.status === "error") {
        setMessage(finalized.message);
        return;
      }
      let note: string | null = null;
      if (guidanceActive && reviewAssessment) {
        const noted = await recordCaptureQualityAction({
          sessionId: session.id,
          photoId: prepared.photoId,
          assessment: reviewAssessment,
          overrideReason: reviewAssessment.status === "poor" ? overrideReason : null,
        });
        if (noted.status === "error") {
          note = noted.message;
        }
      }

      setSavedExtra((current) => [...current, angle.id]);
      resetReview();
      if (note) {
        setMessage(note);
      }
      router.refresh();
    } catch {
      setMessage("The photograph could not be saved. Try again or choose another photograph.");
    } finally {
      setSaving(false);
    }
  }

  async function finish(kind: "complete" | "cancel") {
    setSaving(true);
    setMessage(null);
    const action = kind === "complete" ? finishCaptureAction : cancelCaptureAction;
    try {
      const result = await action({ sessionId: session.id, missingReason: reason });
      if (result?.status === "error") {
        setMessage(result.message);
        setSaving(false);
      }
    } catch (error) {
      unstable_rethrow(error);
      setMessage("The session could not be finished.");
      setSaving(false);
    }
  }

  if (!angle) {
    return <p className="text-base text-muted-foreground">This protocol has no angles.</p>;
  }

  const savedPhoto = session.photos.find((photo) => photo.angleId === angle.id) ?? null;
  const checksComplete = CHECKS.every((item) => checks[item.id]);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm text-muted-foreground">
          {session.patientName} · {session.treatmentName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{angle.name}</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Angle {angleIndex + 1} of {session.protocol.angles.length}
        </p>
      </div>
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <div className="relative min-h-[68dvh] overflow-hidden rounded-2xl bg-black ring-2 ring-primary/50">
        {pendingFile && previewUrl ? (
          // The review image is a local photograph that has not been uploaded yet.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={`Review of ${angle.name}`} className="min-h-[68dvh] w-full object-contain" />
        ) : savedPhoto?.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={savedPhoto.previewUrl} alt={angle.name} className="min-h-[68dvh] w-full object-contain" />
        ) : (
          <video ref={videoRef} className="min-h-[68dvh] w-full object-contain" playsInline muted autoPlay />
        )}
        {pendingFile || savedPhoto ? (
          <p className="pointer-events-none absolute top-3 left-3 rounded-full bg-card/95 px-3 py-1 text-sm font-medium text-primary">
            Uploaded photograph
          </p>
        ) : null}
        {!pendingFile && !savedPhoto ? (
          <>
            {showPreviousPhotograph && reference?.previewUrl ? (
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
      {reference?.previewUrl && !pendingFile && !savedPhoto && !locked && !alreadySaved ? (
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="min-h-11"
          aria-pressed={showPreviousPhotograph}
          onClick={() => setShowPreviousPhotograph((current) => !current)}
        >
          {showPreviousPhotograph ? "Hide previous photograph" : "Show previous photograph"}
        </Button>
      ) : null}
      {cameraMessage && !pendingFile && !savedPhoto ? (
        <p className="text-sm text-muted-foreground" role="status">
          {cameraMessage}
        </p>
      ) : null}
      {guidanceActive && !pendingFile && !savedPhoto && liveAssessment ? (
        <p className="text-base" role="status">
          {liveAssessment.instruction}
        </p>
      ) : null}
      {locked || alreadySaved ? (
        <p className="text-base text-muted-foreground">
          {alreadySaved ? "This angle is saved." : "This session is closed."}
        </p>
      ) : pendingFile ? (
        <div className="flex flex-col gap-3">
          {reviewAssessment ? (
            <p className="text-base" role="status">
              {reviewAssessment.instruction}
            </p>
          ) : null}
          {reviewAssessment?.status === "poor" ? (
            <label className="flex flex-col gap-2 text-base font-medium" htmlFor="override-reason">
              Reason for using this photograph
              <Textarea
                id="override-reason"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                placeholder="Required when guidance asks for a retake."
              />
            </label>
          ) : null}
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
            <Button type="button" size="lg" onClick={() => void acceptPhotograph()} disabled={saving || !checksComplete || (reviewAssessment?.status === "poor" && overrideReason.trim().length < 3)}>
              {saving ? "Saving…" : "Use this photograph"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3">
            <Button type="button" size="lg" className="w-full" onClick={() => void captureFrame()} disabled={Boolean(cameraMessage)}>
              Capture
            </Button>
            <Button type="button" size="lg" variant="outline" className="w-full" onClick={() => setFacing((current) => (current === "environment" ? "user" : "environment"))}>
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
        <Button type="button" size="lg" variant="outline" disabled={angleIndex === 0} onClick={() => { resetReview(); setShowPreviousPhotograph(false); setAngleIndex((current) => current - 1); }}>
          Previous
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={angleIndex >= session.protocol.angles.length - 1}
          onClick={() => { resetReview(); setShowPreviousPhotograph(false); setAngleIndex((current) => current + 1); }}
        >
          Next angle
        </Button>
      </div>
      {!locked ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <details className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
            <summary className="min-h-11 cursor-pointer text-base font-medium">Session details</summary>
            <div className="mt-3 flex flex-col gap-3">
              <SessionReview
                review={reviewSession(
                  session.protocol.angles.map((item) => ({ id: item.id, name: item.name })),
                  session.photos.map((photo) => ({ id: photo.id, angleId: photo.angleId })),
                )}
              />
              <p className="text-base leading-7">{angle.instructions}</p>
              <Label htmlFor="missing-reason">Missing angles</Label>
              <Textarea
                id="missing-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Required when the series is incomplete."
              />
              {guidanceActive ? <SavedGuidance session={session} /> : null}
              {guidanceEnabled && session.canManageGuidance ? (
                <label className="flex min-h-11 items-center gap-3 text-base">
                  <input
                    type="checkbox"
                    checked={guidanceOn}
                    onChange={(event) => {
                      const next = event.target.checked;
                      setGuidanceOn(next);
                      void saveCaptureSettingsAction({ guidanceEnabled: next });
                    }}
                  />
                  Smart guidance for this clinic
                </label>
              ) : null}
            </div>
          </details>
          <div className="flex flex-col gap-3">
            <Button type="button" size="lg" className="w-full" disabled={saving} onClick={() => void finish("complete")}>
              Finish session
            </Button>
            <Button type="button" size="lg" variant="outline" className="w-full" disabled={saving} onClick={() => void finish("cancel")}>
              {uploadedCount === 0 ? "Discard session" : "Cancel session"}
            </Button>
          </div>
          <p className="text-base text-muted-foreground">{uploadedCount} of {session.protocol.angles.length} angles saved.</p>
        </form>
      ) : (
        <p className="text-base text-muted-foreground">
          This session is {session.status}. {uploadedCount} of {session.protocol.angles.length} angles were saved.
        </p>
      )}
    </div>
  );
}

function SavedGuidance({ session }: { session: CaptureSessionView }) {
  const noted = session.photos.filter((photo) => photo.quality);
  if (noted.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2" aria-label="Capture guidance">
      <h2 className="text-base font-medium">Guidance for saved photographs</h2>
      <ul className="flex flex-col gap-2">
        {noted.map((photo) => {
          const angle = session.protocol.angles.find((item) => item.id === photo.angleId);
          return (
            <li key={photo.id} className="flex flex-col gap-2 text-base">
              <span>
                {angle?.name ?? "Photograph"}: {photo.quality?.instruction}
              </span>
              {photo.quality ? (
                <SetupSuggestions status={photo.quality.status} warnings={photo.quality.warnings} />
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
