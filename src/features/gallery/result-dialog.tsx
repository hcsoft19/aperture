"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { loadGalleryResult } from "./actions";
import { ResultView } from "./result-view";
import type { GalleryResult } from "./models";

export function ResultDialog({
  resultId,
  onClose,
}: {
  resultId: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<GalleryResult | null>(null);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setMessage("");
      try {
        const response = await loadGalleryResult(resultId);
        if (!active) return;
        if (response.ok) setResult(response.data);
        else setMessage(response.message);
      } catch {
        if (active)
          setMessage("This result could not be loaded. Please try again.");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [resultId, attempt]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="result-dialog-title"
      className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%_-_24px)] max-w-6xl overflow-y-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl backdrop:bg-black/50 sm:p-8"
    >
      <header className="mb-6 flex items-start justify-between gap-5">
        <div>
          <p className="eyebrow mb-2 text-primary">A closer look</p>
          <h2
            id="result-dialog-title"
            className="text-2xl font-medium tracking-tight sm:text-3xl"
          >
            {result?.treatmentName ?? "Loading result…"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-base hover:bg-muted"
        >
          <X aria-hidden="true" className="size-5" />
          Close
        </button>
      </header>
      {message ? (
        <div role="alert" className="py-8 text-base">
          <p>{message}</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="mt-4 min-h-11 rounded-lg border border-border px-4"
          >
            Try again
          </button>
        </div>
      ) : result ? (
        <ResultView result={result} />
      ) : (
        <p className="py-12 text-base text-muted-foreground" role="status">
          Loading photographs and session details…
        </p>
      )}
      {result ? (
        <Link
          href={`/results/${result.id}`}
          className="mt-6 inline-flex min-h-11 items-center gap-2 text-base font-medium text-primary hover:underline"
        >
          Open dedicated result page{" "}
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </dialog>
  );
}
