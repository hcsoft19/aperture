import { createElement, useState, type FormEvent } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCatalogOption } from "@/features/catalog/actions";
import { CatalogCombobox } from "@/features/catalog/catalog-combobox";
import {
  catalogOptionTypeSchema,
  catalogOptionTypes,
  createCatalogOptionSchema,
  getMaxLength,
  normalizeKey,
  updateCatalogOptionSchema,
  type CatalogOption,
  type CatalogOptionType,
} from "@/features/catalog/schemas";

vi.mock("@/features/catalog/actions", () => ({
  createCatalogOption: vi.fn(),
}));

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

const botox: CatalogOption = {
  id: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
  type: "treatment_name",
  displayName: "Botox",
  isActive: true,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function CatalogFieldHarness({
  type,
  label,
  options,
  onSubmit,
}: {
  type: CatalogOptionType;
  label: string;
  options: CatalogOption[];
  onSubmit?: () => void;
}) {
  const [value, setValue] = useState("");
  return createElement(
    "form",
    {
      onSubmit: (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onSubmit?.();
      },
    },
    createElement(CatalogCombobox, {
      type,
      label,
      options,
      value,
      onChange: setValue,
    }),
    createElement("p", { "data-testid": "committed" }, value),
    createElement("button", { type: "submit" }, "Save treatment"),
  );
}

describe("CatalogCombobox", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("commits trimmed text while typing for every catalog field", async () => {
    const user = userEvent.setup();

    for (const type of catalogOptionTypes) {
      cleanup();
      render(
        createElement(CatalogFieldHarness, {
          type,
          label: type,
          options: [],
        }),
      );

      await user.type(screen.getByRole("combobox", { name: type }), "  Cheek filler  ");

      expect(screen.getByRole("combobox", { name: type })).toHaveValue("  Cheek filler  ");
      expect(screen.getByTestId("committed").textContent).toBe("Cheek filler");
    }
  });

  it("fills the field when a suggestion is chosen", async () => {
    const user = userEvent.setup();
    render(
      createElement(CatalogFieldHarness, {
        type: "treatment_name",
        label: "Treatment",
        options: [botox],
      }),
    );

    await user.click(screen.getByRole("combobox", { name: "Treatment" }));
    await user.click(screen.getByRole("option", { name: "Botox" }));

    expect(screen.getByTestId("committed").textContent).toBe("Botox");
    expect(screen.getByRole("combobox", { name: "Treatment" })).toHaveValue("Botox");
  });

  it("selects a highlighted suggestion on Enter without submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      createElement(CatalogFieldHarness, {
        type: "treatment_name",
        label: "Treatment",
        options: [botox],
        onSubmit,
      }),
    );

    const input = screen.getByRole("combobox", { name: "Treatment" });
    await user.type(input, "Bo");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId("committed").textContent).toBe("Botox");
    expect(createCatalogOption).not.toHaveBeenCalled();
  });

  it("already has the typed text as the parent value when Enter has no highlight", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      createElement(CatalogFieldHarness, {
        type: "category",
        label: "Category",
        options: [botox],
        onSubmit,
      }),
    );

    const input = screen.getByRole("combobox", { name: "Category" });
    await user.type(input, "  Skin booster  ");

    expect(screen.getByTestId("committed").textContent).toBe("Skin booster");

    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("committed").textContent).toBe("Skin booster");
    expect(createCatalogOption).not.toHaveBeenCalled();
  });

  it("creates a catalog option when the create row is highlighted", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    vi.mocked(createCatalogOption).mockResolvedValue({
      status: "success",
      option: {
        ...botox,
        id: "33333333-3333-4333-8333-333333333333",
        displayName: "Microneedling",
      },
    });
    render(
      createElement(CatalogFieldHarness, {
        type: "treatment_name",
        label: "Treatment",
        options: [],
        onSubmit,
      }),
    );

    await user.type(screen.getByRole("combobox", { name: "Treatment" }), "Microneedling");
    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(createCatalogOption).toHaveBeenCalledWith({
        type: "treatment_name",
        displayName: "Microneedling",
      });
    });
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId("committed").textContent).toBe("Microneedling");
    });
  });
});
