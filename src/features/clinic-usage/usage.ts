import {
  PROTOTYPE_FEATURES,
  PROTOTYPE_PLAN_ID,
  PROTOTYPE_STORAGE_LIMIT_BYTES,
  admitPhotographSchema,
  assignPrototypePlanSchema,
  downgradeLimitSchema,
  exportUsageSchema,
  measureUsageSchema,
  organizationIdSchema,
  quotaMessages,
  type ClinicEntitlement,
  type StoredPhotograph,
  type UsageStatus,
} from "@/features/clinic-usage/schema";

export {
  PROTOTYPE_FEATURES,
  PROTOTYPE_PLAN_ID,
  PROTOTYPE_STORAGE_LIMIT_BYTES,
  quotaMessages,
  type ClinicEntitlement,
  type StoredPhotograph,
  type UsageStatus,
};

export type StorageUsage = {
  organizationId: string;
  planId: typeof PROTOTYPE_PLAN_ID;
  limitBytes: number;
  usedBytes: number;
  unknownSizeCount: number;
  status: UsageStatus;
  photographIds: string[];
};

export type MeasureUsageResult =
  | { ok: true; usage: StorageUsage }
  | { ok: false; reason: "invalid" };

export type AssignPlanResult =
  | { ok: true; entitlements: ClinicEntitlement[] }
  | { ok: false; reason: "invalid" };

export type CheckoutResult = {
  ok: false;
  reason: "paid_billing_unavailable";
  message: typeof quotaMessages.paidBilling;
};

type Retention = {
  photographs: StoredPhotograph[];
  deletedCount: 0;
  hiddenCount: 0;
};

export type AdmitResult =
  | (Retention & {
      ok: true;
      accepted: true;
      refusal: null;
      message: null;
      status: UsageStatus;
      usedBytes: number;
      unknownSizeCount: number;
      limitBytes: number;
    })
  | (Retention & {
      ok: true;
      accepted: false;
      refusal: "above_limit";
      message: typeof quotaMessages.aboveLimit;
      status: UsageStatus;
      usedBytes: number;
      unknownSizeCount: number;
      limitBytes: number;
    })
  | { ok: false; reason: "invalid" };

export type DowngradeResult =
  | (Retention & { ok: true; usage: StorageUsage })
  | (Retention & { ok: false; reason: "not_smaller" })
  | { ok: false; reason: "invalid" };

export type UsageExport = {
  feature: "usage_export";
  organizationId: string;
  planId: typeof PROTOTYPE_PLAN_ID;
  usedBytes: number;
  unknownSizeCount: number;
  limitBytes: number;
  status: UsageStatus;
  photographCount: number;
};

export type ExportUsageResult =
  | { ok: true; export: UsageExport }
  | { ok: false; reason: "invalid" }
  | {
      ok: false;
      reason: "unavailable";
      message: typeof quotaMessages.paidExport;
    };

/**
 * Clinic storage entitlements for the prototype plan.
 * A quota decision never removes or hides a stored photograph.
 * Paid checkout stays outside this module.
 */
export function assignPrototypePlan(organizationIds: unknown): AssignPlanResult {
  const parsed = assignPrototypePlanSchema.safeParse(organizationIds);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  const seen = new Set<string>();
  const entitlements: ClinicEntitlement[] = [];

  for (const organizationId of parsed.data) {
    if (seen.has(organizationId)) {
      continue;
    }

    seen.add(organizationId);
    entitlements.push({
      organizationId,
      planId: PROTOTYPE_PLAN_ID,
      storageLimitBytes: PROTOTYPE_STORAGE_LIMIT_BYTES,
      paidCheckout: false,
      features: PROTOTYPE_FEATURES,
    });
  }

  return { ok: true, entitlements };
}

/** Paid checkout is unavailable on the prototype plan. */
export function requestPaidCheckout(
  organizationId: unknown,
): CheckoutResult | { ok: false; reason: "invalid" } {
  const parsed = organizationIdSchema.safeParse(organizationId);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: false,
    reason: "paid_billing_unavailable",
    message: quotaMessages.paidBilling,
  };
}

export function measureUsage(input: unknown): MeasureUsageResult {
  const parsed = measureUsageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  const summed = sumSizes(parsed.data.photographs, parsed.data.organizationId);
  if (!summed.ok) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    usage: usageFrom(parsed.data.organizationId, parsed.data.limitBytes, summed),
  };
}

export function admitPhotograph(input: unknown): AdmitResult {
  const parsed = admitPhotographSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  const { organizationId, photographs, incoming, limitBytes } = parsed.data;
  if (incoming.organizationId !== organizationId) {
    return { ok: false, reason: "invalid" };
  }

  const summed = sumSizes(photographs, organizationId);
  if (!summed.ok || summed.photographIds.includes(incoming.id)) {
    return { ok: false, reason: "invalid" };
  }

  const incomingBytes = incoming.fileSizeBytes ?? 0;
  if (incomingBytes > Number.MAX_SAFE_INTEGER - summed.usedBytes) {
    return { ok: false, reason: "invalid" };
  }

  const projected = summed.usedBytes + incomingBytes;
  if (projected > limitBytes) {
    return {
      ok: true,
      accepted: false,
      refusal: "above_limit",
      message: quotaMessages.aboveLimit,
      ...usageFields(limitBytes, summed),
      ...retain(photographs),
    };
  }

  const withIncoming = sumSizes([...photographs, incoming], organizationId);
  if (!withIncoming.ok) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    accepted: true,
    refusal: null,
    message: null,
    ...usageFields(limitBytes, withIncoming),
    ...retain([...photographs, incoming]),
  };
}

/**
 * Applies a smaller storage limit. Every stored photograph stays.
 * The smaller limit does not erase usage or originals.
 */
export function downgradeLimit(input: unknown): DowngradeResult {
  const parsed = downgradeLimitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  const { organizationId, photographs, currentLimitBytes, nextLimitBytes } = parsed.data;
  const summed = sumSizes(photographs, organizationId);
  if (!summed.ok) {
    return { ok: false, reason: "invalid" };
  }

  if (nextLimitBytes >= currentLimitBytes) {
    return {
      ok: false,
      reason: "not_smaller",
      ...retain(photographs),
    };
  }

  return {
    ok: true,
    usage: usageFrom(organizationId, nextLimitBytes, summed),
    ...retain(photographs),
  };
}

/** Usage export is allowed. The paid_export feature stays unavailable. */
export function exportUsage(input: unknown): ExportUsageResult {
  const parsed = exportUsageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: "invalid" };
  }

  if (parsed.data.feature === "paid_export") {
    return {
      ok: false,
      reason: "unavailable",
      message: quotaMessages.paidExport,
    };
  }

  const measured = measureUsage(parsed.data);
  if (!measured.ok) {
    return { ok: false, reason: "invalid" };
  }

  return {
    ok: true,
    export: {
      feature: "usage_export",
      organizationId: measured.usage.organizationId,
      planId: measured.usage.planId,
      usedBytes: measured.usage.usedBytes,
      unknownSizeCount: measured.usage.unknownSizeCount,
      limitBytes: measured.usage.limitBytes,
      status: measured.usage.status,
      photographCount: measured.usage.photographIds.length,
    },
  };
}

type SizeSum = {
  usedBytes: number;
  unknownSizeCount: number;
  photographIds: string[];
};

function sumSizes(
  photographs: readonly StoredPhotograph[],
  organizationId: string,
): { ok: true } & SizeSum | { ok: false } {
  let usedBytes = 0;
  let unknownSizeCount = 0;
  const photographIds: string[] = [];
  const seen = new Set<string>();

  for (const photograph of photographs) {
    if (photograph.organizationId !== organizationId) {
      continue;
    }

    if (seen.has(photograph.id)) {
      return { ok: false };
    }

    seen.add(photograph.id);
    photographIds.push(photograph.id);

    if (photograph.fileSizeBytes === null) {
      unknownSizeCount += 1;
      continue;
    }

    if (photograph.fileSizeBytes > Number.MAX_SAFE_INTEGER - usedBytes) {
      return { ok: false };
    }

    usedBytes += photograph.fileSizeBytes;
  }

  return { ok: true, usedBytes, unknownSizeCount, photographIds };
}

/** Warning starts at 80 percent and includes the limit. Above the limit is blocked. */
function storageStatus(usedBytes: number, limitBytes: number): UsageStatus {
  if (usedBytes > limitBytes) {
    return "blocked";
  }

  if (BigInt(usedBytes) * BigInt(5) >= BigInt(limitBytes) * BigInt(4)) {
    return "warning";
  }

  return "ok";
}

function usageFrom(
  organizationId: string,
  limitBytes: number,
  summed: SizeSum,
): StorageUsage {
  return {
    organizationId,
    planId: PROTOTYPE_PLAN_ID,
    limitBytes,
    usedBytes: summed.usedBytes,
    unknownSizeCount: summed.unknownSizeCount,
    status: storageStatus(summed.usedBytes, limitBytes),
    photographIds: summed.photographIds,
  };
}

function usageFields(limitBytes: number, summed: SizeSum) {
  return {
    limitBytes,
    usedBytes: summed.usedBytes,
    unknownSizeCount: summed.unknownSizeCount,
    status: storageStatus(summed.usedBytes, limitBytes),
  };
}

function retain(photographs: StoredPhotograph[]): Retention {
  return {
    photographs,
    deletedCount: 0,
    hiddenCount: 0,
  };
}
