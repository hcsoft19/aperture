import { z } from "zod";

/** The only plan. Every clinic receives it. Paid checkout is not part of this plan. */
export const PROTOTYPE_PLAN_ID = "prototype" as const;

/** Stored photograph bytes allowed on the prototype plan. */
export const PROTOTYPE_STORAGE_LIMIT_BYTES = 500_000_000;

export const PROTOTYPE_FEATURES = {
  usage_export: true,
  paid_export: false,
} as const;

export const usageStatuses = ["ok", "warning", "blocked"] as const;

export type UsageStatus = (typeof usageStatuses)[number];

export const entitlementFeatures = ["usage_export", "paid_export"] as const;

export type EntitlementFeature = (typeof entitlementFeatures)[number];

export const quotaMessages = {
  aboveLimit:
    "That photograph would pass the storage limit, so it was not added.",
  paidBilling: "Paid billing is not available.",
  paidExport: "Paid export is not available on this plan.",
} as const;

/** Whole byte counts that stay inside the safe integer range. */
export const byteCountSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

export const organizationIdSchema = z.string().trim().min(1).max(120);

export const storedPhotographSchema = z.object({
  id: z.string().trim().min(1).max(120),
  organizationId: organizationIdSchema,
  fileSizeBytes: byteCountSchema.nullable(),
});

export type StoredPhotograph = z.infer<typeof storedPhotographSchema>;

export const prototypeEntitlementSchema = z.object({
  organizationId: organizationIdSchema,
  planId: z.literal(PROTOTYPE_PLAN_ID),
  storageLimitBytes: z.literal(PROTOTYPE_STORAGE_LIMIT_BYTES),
  paidCheckout: z.literal(false),
  features: z.object({
    usage_export: z.literal(true),
    paid_export: z.literal(false),
  }),
});

export type ClinicEntitlement = z.infer<typeof prototypeEntitlementSchema>;

export const assignPrototypePlanSchema = z.array(organizationIdSchema);

export const measureUsageSchema = z.object({
  organizationId: organizationIdSchema,
  photographs: z.array(storedPhotographSchema),
  limitBytes: byteCountSchema.default(PROTOTYPE_STORAGE_LIMIT_BYTES),
});

export const admitPhotographSchema = measureUsageSchema.extend({
  incoming: storedPhotographSchema,
});

export const downgradeLimitSchema = z.object({
  organizationId: organizationIdSchema,
  photographs: z.array(storedPhotographSchema),
  currentLimitBytes: byteCountSchema.default(PROTOTYPE_STORAGE_LIMIT_BYTES),
  nextLimitBytes: byteCountSchema,
});

export const exportUsageSchema = z.object({
  feature: z.enum(entitlementFeatures).default("usage_export"),
  organizationId: organizationIdSchema,
  photographs: z.array(storedPhotographSchema),
  limitBytes: byteCountSchema.default(PROTOTYPE_STORAGE_LIMIT_BYTES),
});
