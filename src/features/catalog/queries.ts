import { getWorkspace } from "@/features/access/workspace";
import {
  type CatalogOption,
  type CatalogOptionType,
} from "@/features/catalog/schemas";
import { createClient } from "@/lib/supabase/server";

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

export async function getCatalogOptions(
  type: CatalogOptionType,
  includeInactive = false,
): Promise<CatalogOption[]> {
  const workspace = await getWorkspace();

  if (workspace?.kind !== "staff" || !workspace.activeMembership) {
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

export async function getAllCatalogOptions(
  includeInactive = false,
): Promise<Record<CatalogOptionType, CatalogOption[]>> {
  const workspace = await getWorkspace();

  if (workspace?.kind !== "staff" || !workspace.activeMembership) {
    return {
      treatment_name: [],
      category: [],
      procedure_type: [],
      product: [],
      body_area: [],
    };
  }

  const supabase = await createClient();
  let query = supabase
    .from("clinic_catalog_options")
    .select("id, organization_id, option_type, display_name, is_active, sort_order, created_at")
    .eq("organization_id", workspace.activeMembership.organizationId)
    .order("sort_order", { ascending: true })
    .order("display_name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error || !data) {
    return {
      treatment_name: [],
      category: [],
      procedure_type: [],
      product: [],
      body_area: [],
    };
  }

  const result: Record<CatalogOptionType, CatalogOption[]> = {
    treatment_name: [],
    category: [],
    procedure_type: [],
    product: [],
    body_area: [],
  };

  for (const row of data) {
    const option = mapRowToOption(row);
    result[option.type].push(option);
  }

  return result;
}
