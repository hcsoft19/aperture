import type { CaptureMimeType } from "@/features/capture/rules";

export type PhotographDetails = {
  sha256: string;
  width: number;
  height: number;
  mimeType: CaptureMimeType;
  fileSizeBytes: number;
};

const MIME_TYPES = new Set<CaptureMimeType>(["image/jpeg", "image/png", "image/webp"]);

export function isCaptureMime(value: string): value is CaptureMimeType {
  return MIME_TYPES.has(value as CaptureMimeType);
}

export async function describePhotograph(file: Blob): Promise<PhotographDetails | null> {
  if (!isCaptureMime(file.type) || file.size < 1 || file.size > 10485760) {
    return null;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const bitmap = await createImageBitmap(new Blob([bytes], { type: file.type }));
  const details = {
    sha256: [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join(""),
    width: bitmap.width,
    height: bitmap.height,
    mimeType: file.type,
    fileSizeBytes: file.size,
  };
  bitmap.close();
  return details;
}

export async function frameFromVideo(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context || canvas.width < 1 || canvas.height < 1) {
    return null;
  }

  context.drawImage(video, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.92);
  });
  return blob;
}
