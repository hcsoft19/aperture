import {
  CONSENT_PURPOSES,
  consentVersion,
  type ConsentPurpose,
} from "@/features/purpose-consent/purposes";

export type ConsentRecord = {
  id?: string;
  purpose: ConsentPurpose;
  version: string;
  grantedBy: string;
  grantedAt: string;
  revokedAt: string | null;
};

export type ConsentSummary = {
  purpose: ConsentPurpose;
  version: string;
  allowed: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
};

export function createConsentRecord(input: {
  purpose: ConsentPurpose;
  grantedBy: string;
  grantedAt: Date;
  id?: string;
}): ConsentRecord {
  return {
    id: input.id,
    purpose: input.purpose,
    version: consentVersion(input.purpose),
    grantedBy: input.grantedBy,
    grantedAt: input.grantedAt.toISOString(),
    revokedAt: null,
  };
}

export function withdraw(record: ConsentRecord, now: Date): ConsentRecord {
  if (record.revokedAt !== null) {
    return record;
  }

  const grantedAt = Date.parse(record.grantedAt);
  const revokedTime = Number.isNaN(grantedAt)
    ? now.getTime()
    : Math.max(now.getTime(), grantedAt);

  return {
    ...record,
    revokedAt: new Date(revokedTime).toISOString(),
  };
}

export function consentAllows(
  records: readonly ConsentRecord[],
  purpose: ConsentPurpose,
  now: Date,
): boolean {
  return records.some((record) => isActive(record, purpose, now));
}

export function consentSummaries(
  records: readonly ConsentRecord[],
  now: Date,
): ConsentSummary[] {
  return CONSENT_PURPOSES.map((purpose) => summarizePurpose(records, purpose, now));
}

function summarizePurpose(
  records: readonly ConsentRecord[],
  purpose: ConsentPurpose,
  now: Date,
): ConsentSummary {
  const version = consentVersion(purpose);
  const matching = records.filter(
    (record) => record.purpose === purpose && record.version === version,
  );
  const active = latest(
    matching.filter((record) => isActive(record, purpose, now)),
    (record) => record.grantedAt,
  );
  const revoked = latest(
    matching.filter((record) => record.revokedAt !== null),
    (record) => record.revokedAt,
  );

  return {
    purpose,
    version,
    allowed: active !== null,
    grantedAt: active?.grantedAt ?? null,
    revokedAt: active ? null : (revoked?.revokedAt ?? null),
  };
}

function isActive(
  record: ConsentRecord,
  purpose: ConsentPurpose,
  now: Date,
): boolean {
  if (record.purpose !== purpose || record.version !== consentVersion(purpose)) {
    return false;
  }

  if (record.grantedBy.trim().length === 0) {
    return false;
  }

  const grantedAt = Date.parse(record.grantedAt);
  if (Number.isNaN(grantedAt) || grantedAt > now.getTime()) {
    return false;
  }

  if (record.revokedAt === null) {
    return true;
  }

  const revokedAt = Date.parse(record.revokedAt);
  return !Number.isNaN(revokedAt) && revokedAt > now.getTime();
}

function latest(
  records: readonly ConsentRecord[],
  timeOf: (record: ConsentRecord) => string | null,
): ConsentRecord | null {
  let best: ConsentRecord | null = null;
  let bestTime = Number.NEGATIVE_INFINITY;

  for (const record of records) {
    const value = timeOf(record);
    if (!value) {
      continue;
    }

    const time = Date.parse(value);
    if (Number.isNaN(time) || time < bestTime) {
      continue;
    }

    best = record;
    bestTime = time;
  }

  return best;
}
