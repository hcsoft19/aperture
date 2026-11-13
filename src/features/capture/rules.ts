const PHOTO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type CaptureMimeType = keyof typeof PHOTO_EXTENSION;

export function clinicalStoragePath(input: {
  organizationId: string;
  patientId: string;
  sessionId: string;
  angleId: string;
  photoId: string;
  mimeType: CaptureMimeType;
}) {
  const extension = PHOTO_EXTENSION[input.mimeType];
  return `${input.organizationId}/${input.patientId}/${input.sessionId}/${input.angleId}/${input.photoId}.${extension}`;
}

export function canFinishSession(input: {
  uploadedCount: number;
  angleCount: number;
  missingReason: string;
}) {
  if (input.uploadedCount < 1) {
    return "Capture at least one photograph before finishing the session.";
  }

  if (input.uploadedCount < input.angleCount && input.missingReason.trim().length < 3) {
    return "Explain why some angles are missing.";
  }

  return null;
}

export function canCancelSession(input: { uploadedCount: number; missingReason: string }) {
  if (input.uploadedCount > 0 && input.missingReason.trim().length < 3) {
    return "Explain why the session is being cancelled.";
  }

  return null;
}
