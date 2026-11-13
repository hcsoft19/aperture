"use server";

import { z } from "zod";
import { getWorkspace } from "@/features/access/workspace";
import { createClient } from "@/lib/supabase/server";

const comparisonSchema = z.object({
  beforeId: z.string().uuid(),
  afterId: z.string().uuid(),
  x: z.number().finite().min(-50).max(50),
  y: z.number().finite().min(-50).max(50),
  rotation: z.number().finite().min(-30).max(30),
  scale: z.number().finite().min(0.5).max(2),
});

export async function saveComparisonAction(input: z.infer<typeof comparisonSchema>) {
  const parsed = comparisonSchema.safeParse(input);
  const workspace = await getWorkspace();
  if (!parsed.success || !workspace?.activeMembership || workspace.kind !== "staff") {
    return { ok: false, message: "The comparison could not be saved." };
  }

  const supabase = await createClient();
  const { data: photos, error } = await supabase.from("photos")
    .select("id, angle_id, upload_status, photo_sessions!inner(treatment_id, session_type, status, treatments!inner(patients!inner(organization_id)))")
    .in("id", [parsed.data.beforeId, parsed.data.afterId])
    .eq("photo_sessions.treatments.patients.organization_id", workspace.activeMembership.organizationId);
  const before = photos?.find((photo) => photo.id === parsed.data.beforeId);
  const after = photos?.find((photo) => photo.id === parsed.data.afterId);
  if (error || !before || !after || before.id === after.id || before.angle_id !== after.angle_id ||
      before.upload_status !== "uploaded" || after.upload_status !== "uploaded" ||
      before.photo_sessions.status !== "completed" || after.photo_sessions.status !== "completed" ||
      before.photo_sessions.session_type !== "baseline" || after.photo_sessions.session_type !== "follow_up" ||
      before.photo_sessions.treatment_id !== after.photo_sessions.treatment_id) {
    return { ok: false, message: "Choose completed photographs of the same angle and treatment." };
  }

  const { error: saveError } = await supabase.from("comparisons").insert({
    treatment_id: before.photo_sessions.treatment_id,
    before_photo_id: before.id,
    after_photo_id: after.id,
    created_by: workspace.user.id,
    alignment: { x: parsed.data.x, y: parsed.data.y, rotation: parsed.data.rotation, scale: parsed.data.scale },
  });
  return saveError ? { ok: false, message: "The comparison could not be saved." } : { ok: true, message: "Comparison saved." };
}
