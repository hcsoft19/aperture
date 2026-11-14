export type ProtocolAngle = {
  id: string;
  name: string;
};

export type SessionPhotoRef = {
  id: string;
  angleId: string;
};

export type MissingAngle = {
  id: string;
  name: string;
};

export type DuplicateAngle = {
  id: string;
  name: string;
  photoIds: string[];
};

export type SessionCompleteness = {
  missing: MissingAngle[];
  duplicates: DuplicateAngle[];
  complete: boolean;
};

export function reviewSession(
  protocol: ProtocolAngle[],
  photos: SessionPhotoRef[],
): SessionCompleteness {
  const photoIdsByAngle = new Map<string, string[]>();

  for (const photo of photos) {
    const photoIds = photoIdsByAngle.get(photo.angleId);
    if (photoIds) {
      photoIds.push(photo.id);
    } else {
      photoIdsByAngle.set(photo.angleId, [photo.id]);
    }
  }

  const missing: MissingAngle[] = [];
  const duplicates: DuplicateAngle[] = [];

  for (const angle of protocol) {
    const photoIds = photoIdsByAngle.get(angle.id) ?? [];
    if (photoIds.length === 0) {
      missing.push({ id: angle.id, name: angle.name });
    } else if (photoIds.length > 1) {
      duplicates.push({
        id: angle.id,
        name: angle.name,
        photoIds: [...photoIds],
      });
    }
  }

  return {
    missing,
    duplicates,
    complete: missing.length === 0 && duplicates.length === 0,
  };
}
