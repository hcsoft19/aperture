"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getWorkspace } from "@/features/access/workspace";
import {
  treatmentTemplateSchema,
  type TreatmentTemplate,
} from "@/features/treatment-templates/model";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type TemplateActionResult =
  | { status: "saved" }
  | { status: "error"; message: string };

export type TemplateListResult =
  | { status: "ready"; templates: TreatmentTemplate[] }
  | { status: "error"; message: string };

type TreatmentTemplateRow = {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  body_area: string;
  protocol_code: string;
  follow_up_days: number | null;
  archived_at: string | null;
  created_by: string;
  created_at: string;
};

type TreatmentTemplateInsert = {
  organization_id: string;
  name: string;
  category: string;
  body_area: string;
  protocol_code: string;
  follow_up_days: number | null;
  created_by: string;
};

type TreatmentTemplateUpdate = {
  archived_at: string;
};

type TreatmentTemplateDatabase = {
  public: {
    Tables: {
      treatment_templates: {
        Row: TreatmentTemplateRow;
        Insert: TreatmentTemplateInsert;
        Update: TreatmentTemplateUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

const TEMPLATE_COLUMNS =
  "id, organization_id, name, category, body_area, protocol_code, follow_up_days, archived_at, created_by, created_at";

function treatmentTemplates(supabase: SupabaseClient<Database>) {
  // The generated Database type does not include this table yet. The cast stays local.
  return (supabase as unknown as SupabaseClient<TreatmentTemplateDatabase>).from(
    "treatment_templates",
  );
}

function toTreatmentTemplate(row: TreatmentTemplateRow): TreatmentTemplate {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    category: row.category,
    bodyArea: row.body_area,
    protocolCode: row.protocol_code,
    followUpDays: row.follow_up_days,
    archivedAt: row.archived_at,
  };
}

async function staffWorkspace() {
  const workspace = await getWorkspace();
  if (!workspace) {
    redirect("/login");
  }
  if (workspace.kind !== "staff" || !workspace.activeMembership) {
    return null;
  }
  return workspace;
}

export async function listTreatmentTemplatesAction(): Promise<TemplateListResult> {
  const workspace = await staffWorkspace();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "Treatment templates are limited to clinic staff.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await treatmentTemplates(supabase)
    .select(TEMPLATE_COLUMNS)
    .eq("organization_id", workspace.activeMembership.organizationId)
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (error || !data) {
    return { status: "error", message: "Treatment templates could not be loaded." };
  }

  return { status: "ready", templates: data.map(toTreatmentTemplate) };
}

export async function createTreatmentTemplateAction(
  values: unknown,
): Promise<TemplateActionResult> {
  const parsed = treatmentTemplateSchema.safeParse(values);
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the template and try again.",
    };
  }

  const workspace = await staffWorkspace();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "Treatment templates are limited to clinic staff.",
    };
  }
  if (workspace.activeMembership.role !== "clinic_admin") {
    return {
      status: "error",
      message: "Only a clinic administrator can save a template.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await treatmentTemplates(supabase)
    .insert({
      organization_id: workspace.activeMembership.organizationId,
      name: parsed.data.name,
      category: parsed.data.category,
      body_area: parsed.data.bodyArea,
      protocol_code: parsed.data.protocolCode,
      follow_up_days: parsed.data.followUpDays,
      created_by: workspace.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { status: "error", message: "The template could not be saved." };
  }

  revalidatePath("/clinic/templates");
  return { status: "saved" };
}

export async function archiveTreatmentTemplateAction(
  templateId: string,
): Promise<TemplateActionResult> {
  if (!isUuid(templateId)) {
    return { status: "error", message: "The template could not be archived." };
  }

  const workspace = await staffWorkspace();
  if (!workspace?.activeMembership) {
    return {
      status: "error",
      message: "Treatment templates are limited to clinic staff.",
    };
  }
  if (workspace.activeMembership.role !== "clinic_admin") {
    return {
      status: "error",
      message: "Only a clinic administrator can archive a template.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await treatmentTemplates(supabase)
    .update({ archived_at: new Date().toISOString() })
    .eq("id", templateId)
    .eq("organization_id", workspace.activeMembership.organizationId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { status: "error", message: "The template could not be archived." };
  }

  revalidatePath("/clinic/templates");
  return { status: "saved" };
}
