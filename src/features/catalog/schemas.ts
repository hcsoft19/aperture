import { z } from "zod";

export const catalogOptionTypes = [
  "treatment_name",
  "category",
  "procedure_type",
  "product",
  "body_area",
] as const;

export type CatalogOptionType = (typeof catalogOptionTypes)[number];

export const catalogOptionTypeSchema = z.enum(catalogOptionTypes);

const maxLengthByType: Record<CatalogOptionType, number> = {
  treatment_name: 120,
  category: 80,
  procedure_type: 80,
  product: 120,
  body_area: 80,
};

export function getMaxLength(type: CatalogOptionType): number {
  return maxLengthByType[type];
}

export const createCatalogOptionSchema = z.object({
  type: catalogOptionTypeSchema,
  displayName: z
    .string()
    .trim()
    .min(1, "Enter a value.")
    .max(120, "Use 120 characters or fewer."),
});

export const updateCatalogOptionSchema = z.object({
  id: z.string().uuid(),
  displayName: z
    .string()
    .trim()
    .min(1, "Enter a value.")
    .max(120, "Use 120 characters or fewer.")
    .optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type CreateCatalogOptionValues = z.infer<typeof createCatalogOptionSchema>;
export type UpdateCatalogOptionValues = z.infer<typeof updateCatalogOptionSchema>;

export interface CatalogOption {
  id: string;
  organizationId: string;
  type: CatalogOptionType;
  displayName: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export function normalizeKey(value: string): string {
  return value.toLowerCase().trim();
}
