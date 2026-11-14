import { describe, expect, it } from "vitest";

import {
  catalogOptionTypeSchema,
  createCatalogOptionSchema,
  getMaxLength,
  normalizeKey,
  updateCatalogOptionSchema,
} from "@/features/catalog/schemas";

describe("normalizeKey", () => {
  it("lowercases the value", () => {
    expect(normalizeKey("Botox")).toBe("botox");
    expect(normalizeKey("FILLER")).toBe("filler");
  });

  it("trims whitespace", () => {
    expect(normalizeKey("  Botox  ")).toBe("botox");
    expect(normalizeKey("\tFiller\n")).toBe("filler");
  });

  it("handles mixed case with spaces", () => {
    expect(normalizeKey("  Lip Filler  ")).toBe("lip filler");
  });
});

describe("getMaxLength", () => {
  it("returns 120 for treatment_name", () => {
    expect(getMaxLength("treatment_name")).toBe(120);
  });

  it("returns 80 for category", () => {
    expect(getMaxLength("category")).toBe(80);
  });

  it("returns 80 for procedure_type", () => {
    expect(getMaxLength("procedure_type")).toBe(80);
  });

  it("returns 120 for product", () => {
    expect(getMaxLength("product")).toBe(120);
  });

  it("returns 80 for body_area", () => {
    expect(getMaxLength("body_area")).toBe(80);
  });
});

describe("catalogOptionTypeSchema", () => {
  it("accepts valid option types", () => {
    expect(catalogOptionTypeSchema.parse("treatment_name")).toBe("treatment_name");
    expect(catalogOptionTypeSchema.parse("category")).toBe("category");
    expect(catalogOptionTypeSchema.parse("procedure_type")).toBe("procedure_type");
    expect(catalogOptionTypeSchema.parse("product")).toBe("product");
    expect(catalogOptionTypeSchema.parse("body_area")).toBe("body_area");
  });

  it("rejects invalid option types", () => {
    expect(() => catalogOptionTypeSchema.parse("invalid")).toThrow();
    expect(() => catalogOptionTypeSchema.parse("")).toThrow();
    expect(() => catalogOptionTypeSchema.parse(null)).toThrow();
  });
});

describe("createCatalogOptionSchema", () => {
  it("accepts valid input", () => {
    const result = createCatalogOptionSchema.safeParse({
      type: "category",
      displayName: "Botox",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("category");
      expect(result.data.displayName).toBe("Botox");
    }
  });

  it("trims displayName", () => {
    const result = createCatalogOptionSchema.safeParse({
      type: "category",
      displayName: "  Botox  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBe("Botox");
    }
  });

  it("rejects empty displayName", () => {
    const result = createCatalogOptionSchema.safeParse({
      type: "category",
      displayName: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only displayName", () => {
    const result = createCatalogOptionSchema.safeParse({
      type: "category",
      displayName: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects displayName over 120 characters", () => {
    const result = createCatalogOptionSchema.safeParse({
      type: "category",
      displayName: "a".repeat(121),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = createCatalogOptionSchema.safeParse({
      type: "invalid",
      displayName: "Botox",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateCatalogOptionSchema", () => {
  const validUuid = "12345678-1234-4234-8234-123456789012";

  it("accepts valid update with displayName", () => {
    const result = updateCatalogOptionSchema.safeParse({
      id: validUuid,
      displayName: "New Name",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid update with isActive", () => {
    const result = updateCatalogOptionSchema.safeParse({
      id: validUuid,
      isActive: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid update with sortOrder", () => {
    const result = updateCatalogOptionSchema.safeParse({
      id: validUuid,
      sortOrder: 5,
    });
    expect(result.success).toBe(true);
  });

  it("accepts update with multiple fields", () => {
    const result = updateCatalogOptionSchema.safeParse({
      id: validUuid,
      displayName: "New Name",
      isActive: true,
      sortOrder: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    const result = updateCatalogOptionSchema.safeParse({
      id: "not-a-uuid",
      displayName: "New Name",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty displayName", () => {
    const result = updateCatalogOptionSchema.safeParse({
      id: validUuid,
      displayName: "",
    });
    expect(result.success).toBe(false);
  });
});
