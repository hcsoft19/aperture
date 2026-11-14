"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getWorkspace } from "@/features/access/workspace";
import {
  createCatalogOptionSchema,
  updateCatalogOptionSchema,
  normalizeKey,
  getMaxLength,
  type CatalogOption,
  type CatalogOptionType,
  type CreateCatalogOptionValues,
  type UpdateCatalogOptionValues,
} from "@/features/catalog/schemas";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";

export type CatalogActionResult =
  | { status: "success"; option: CatalogOption }
  | { status: "error"; message: string };

export type SimpleActionResult = { status: "error"; message: string } | void;

async function requireStaffClinic() {
  const workspace = await getWorkspace();

  if (!workspace) {
    redirect("/login");
  }

  if (workspace.kind !== "staff" || !workspace.activeMembership) {
    return null;
  }

  return workspace;
}

function mapRowToOption(row: {
  id: string;
  organization_id: string;
  option_type: string;
  display_name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}): CatalogOption {
  return {
    id: row.id,
    organizationId: row.organization_id,
    type: row.option_type as CatalogOptionType,
    displayName: row.display_name,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function listCatalogOptions(
  type: CatalogOptionType,
  includeInactive = false,
): Promise<CatalogOption[]> {
  const workspace = await requireStaffClinic();
  if (!workspace?.activeMembership) {
    return [];
  }

  const supabase = await createClient();
  let query = supabase
    .from("clinic_catalog_options")
    .select("id, organization_id, option_type, display_name, is_active, sort_order, created_at")
    .eq("organization_id", workspace.activeMembership.organizationId)
    .eq("option_type", type)
    .order("sort_order", { ascending: true })
    .order("display_name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map(mapRowToOption);
}

export async function createCatalogOption(
  values: CreateCatalogOptionValues,
): Promise<CatalogActionResult> {
  const parsed = createCatalogOptionSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the value and try again.",
    };
  }

  const maxLength = getMaxLength(parsed.data.type);
  if (parsed.data.displayName.length > maxLength) {
    return {
      status: "error",
      message: `Use ${maxLength} characters or fewer.`,
    };
  }

  const workspace = await requireStaffClinic();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "Catalog options are limited to clinic staff.",
    };
  }

  const supabase = await createClient();
  const normalized = normalizeKey(parsed.data.displayName);

  const { data, error } = await supabase
    .from("clinic_catalog_options")
    .insert({
      organization_id: workspace.activeMembership.organizationId,
      option_type: parsed.data.type,
      normalized_key: normalized,
      display_name: parsed.data.displayName.trim(),
      created_by: workspace.user.id,
    })
    .select("id, organization_id, option_type, display_name, is_active, sort_order, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: "This value already exists in your catalog.",
      };
    }
    return { status: "error", message: "The option could not be saved." };
  }

  if (!data) {
    return { status: "error", message: "The option could not be saved." };
  }

  revalidatePath("/settings/catalog");

  return {
    status: "success",
    option: mapRowToOption(data),
  };
}

export async function updateCatalogOption(
  values: UpdateCatalogOptionValues,
): Promise<SimpleActionResult> {
  const parsed = updateCatalogOptionSchema.safeParse(values);

  if (!parsed.success || !isUuid(parsed.data.id)) {
    return {
      status: "error",
      message: parsed.success
        ? "The option could not be saved."
        : (parsed.error.issues[0]?.message ?? "Check the value and try again."),
    };
  }

  const workspace = await requireStaffClinic();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "Catalog options are limited to clinic administrators.",
    };
  }

  const supabase = await createClient();

  const updates: {
    display_name?: string;
    normalized_key?: string;
    is_active?: boolean;
    sort_order?: number;
  } = {};

  if (parsed.data.displayName !== undefined) {
    updates.display_name = parsed.data.displayName.trim();
    updates.normalized_key = normalizeKey(parsed.data.displayName);
  }

  if (parsed.data.isActive !== undefined) {
    updates.is_active = parsed.data.isActive;
  }

  if (parsed.data.sortOrder !== undefined) {
    updates.sort_order = parsed.data.sortOrder;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  const { data, error } = await supabase
    .from("clinic_catalog_options")
    .update(updates)
    .eq("id", parsed.data.id)
    .eq("organization_id", workspace.activeMembership.organizationId)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: "This value already exists in your catalog.",
      };
    }
    return { status: "error", message: "The option could not be saved." };
  }

  if (!data?.length) {
    return { status: "error", message: "The option could not be saved." };
  }

  revalidatePath("/settings/catalog");
}

export async function deactivateCatalogOption(
  id: string,
): Promise<SimpleActionResult> {
  if (!isUuid(id)) {
    return { status: "error", message: "Invalid option." };
  }

  return updateCatalogOption({ id, isActive: false });
}

export async function reactivateCatalogOption(
  id: string,
): Promise<SimpleActionResult> {
  if (!isUuid(id)) {
    return { status: "error", message: "Invalid option." };
  }

  return updateCatalogOption({ id, isActive: true });
}
