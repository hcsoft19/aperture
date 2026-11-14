"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { editSchema } from "@/features/editor/schema";
import { presentationEdited } from "@/features/editor/schema";
import { getWorkspace } from "@/features/access/workspace";
import { createClient } from "@/lib/supabase/server";

const saveSchema = z.object({
  photoId: z.uuid(),
  edit: editSchema,
});

const derivativeSchema = z.object({
  photoId: z.uuid(),
  revisionId: z.uuid(),
  mimeType: z.enum(["image/jpeg", "image/png"]),
  width: z.number().int().positive().max(8000),
  height: z.number().int().positive().max(8000),
  fileSize: z.number().int().positive().max(10485760),
});

async function staffPhoto(photoId: string) {
  const workspace = await getWorkspace();
  if (!workspace?.activeMembership || workspace.kind !== "staff") {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("photos")
    .select("id, upload_status, photo_sessions!inner(treatments!inner(patients!inner(organization_id)))")
    .eq("id", photoId)
    .eq("upload_status", "uploaded")
    .eq("photo_sessions.treatments.patients.organization_id", workspace.activeMembership.organizationId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return { supabase, workspace, organizationId: workspace.activeMembership.organizationId };
}

export async function saveRevisionAction(input: z.infer<typeof saveSchema>) {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "The edit could not be saved." };
  }

  const context = await staffPhoto(parsed.data.photoId);
  if (!context) {
    return { ok: false as const, message: "The edit could not be saved." };
  }

  const { data: latest } = await context.supabase
    .from("photo_edit_revisions")
    .select("revision_number")
    .eq("photo_id", parsed.data.photoId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await context.supabase
    .from("photo_edit_revisions")
    .insert({
      photo_id: parsed.data.photoId,
      revision_number: (latest?.revision_number ?? 0) + 1,
      schema_version: 1,
      edit_data: parsed.data.edit,
      created_by: context.workspace.user.id,
    })
    .select("id, revision_number")
    .single();

  if (error || !data) {
    return { ok: false as const, message: "The edit could not be saved." };
  }

  await context.supabase.rpc("record_clinical_event", {
    target_org: context.organizationId,
    action: "photo.edit_saved",
    entity_type: "photo",
    entity_id: parsed.data.photoId,
    metadata: {
      revisionId: data.id,
      presentationEdited: presentationEdited(parsed.data.edit),
    },
  });
  revalidatePath("/patients", "layout");
  return { ok: true as const, message: "Edit saved. The original photograph is unchanged.", revisionId: data.id, revisionNumber: data.revision_number };
}

export async function prepareDerivativeAction(input: z.infer<typeof derivativeSchema>) {
  const parsed = derivativeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "The export could not be prepared." };
  }

  const context = await staffPhoto(parsed.data.photoId);
  if (!context) {
    return { ok: false as const, message: "The export could not be prepared." };
  }

  const revision = await context.supabase
    .from("photo_edit_revisions")
    .select("id")
    .eq("id", parsed.data.revisionId)
    .eq("photo_id", parsed.data.photoId)
    .maybeSingle();
  if (revision.error || !revision.data) {
    return { ok: false as const, message: "Save the edit before exporting it." };
  }

  const derivativeId = crypto.randomUUID();
  const extension = parsed.data.mimeType === "image/png" ? "png" : "jpg";
  return {
    ok: true as const,
    derivativeId,
    storagePath: `${context.organizationId}/${derivativeId}.${extension}`,
  };
}

const finalizeSchema = derivativeSchema.extend({
  derivativeId: z.uuid(),
  storagePath: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|jpeg|png)$/),
});

export async function finalizeDerivativeAction(input: z.infer<typeof finalizeSchema>) {
  const parsed = finalizeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: "The export could not be saved." };
  }

  const context = await staffPhoto(parsed.data.photoId);
  if (!context || !parsed.data.storagePath.startsWith(`${context.organizationId}/`)) {
    return { ok: false as const, message: "The export could not be saved." };
  }

  const listed = await context.supabase.storage.from("photo-derivatives").list(context.organizationId, {
    search: parsed.data.derivativeId,
  });
  const object = listed.data?.find((item) => item.name.startsWith(parsed.data.derivativeId));
  const size = object?.metadata && typeof object.metadata === "object" && "size" in object.metadata ? Number(object.metadata.size) : NaN;
  if (!object || !Number.isFinite(size) || size !== parsed.data.fileSize) {
    return { ok: false as const, message: "The export could not be saved." };
  }

  const { error } = await context.supabase.from("photo_derivatives").insert({
    id: parsed.data.derivativeId,
    photo_id: parsed.data.photoId,
    edit_revision_id: parsed.data.revisionId,
    storage_path: parsed.data.storagePath,
    mime_type: parsed.data.mimeType,
    width: parsed.data.width,
    height: parsed.data.height,
    file_size_bytes: parsed.data.fileSize,
    created_by: context.workspace.user.id,
  });
  if (error) {
    return { ok: false as const, message: "The export could not be saved." };
  }

  await context.supabase.rpc("record_clinical_event", {
    target_org: context.organizationId,
    action: "photo.exported",
    entity_type: "photo",
    entity_id: parsed.data.photoId,
    metadata: {
      format: parsed.data.mimeType,
      derivativeId: parsed.data.derivativeId,
      presentationEdited: true,
    },
  });
  return { ok: true as const, message: "Export saved in the private clinic library." };
}
