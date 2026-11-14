"use server";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspace } from "@/features/access/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  clinicProfileSchema,
  publicationSchema,
  publicSlug,
  socialPlatforms,
  whatsappUrl,
} from "./models";
type ActionResult = { ok: boolean; message: string };
async function admin() {
  const w = await getWorkspace();
  return w?.kind === "staff" && w.activeMembership?.role === "clinic_admin"
    ? { org: w.activeMembership.organizationId, user: w.user.id }
    : null;
}
function refresh() {
  revalidatePath("/clinic");
  revalidatePath("/clinics", "layout");
}
export async function saveClinicProfile(input: unknown): Promise<ActionResult> {
  const parsed = clinicProfileSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the clinic details.",
    };
  const access = await admin();
  if (!access)
    return {
      ok: false,
      message: "Only a clinic administrator can edit the public profile.",
    };
  const { booking_mode, booking_destination, booking_label, ...values } =
    parsed.data;
  const socials = Object.fromEntries(
    socialPlatforms.map((key) => [key, values[key]]),
  );
  const {
    instagram: _i,
    facebook: _f,
    tiktok: _t,
    linkedin: _l,
    youtube: _y,
    ...fields
  } = values;
  void _i;
  void _f;
  void _t;
  void _l;
  void _y;
  const db = await createClient();
  const { error } = await db.from("clinic_profiles").upsert(
    {
      ...fields,
      organization_id: access.org,
      social_links: socials,
      booking_label: booking_label || "Book a consultation",
      booking_url:
        booking_mode === "none"
          ? ""
          : booking_mode === "whatsapp"
            ? whatsappUrl(values.whatsapp)
            : booking_destination,
    },
    { onConflict: "organization_id" },
  );
  if (error)
    return {
      ok: false,
      message:
        error.code === "23505" || error.message.includes("Address unavailable")
          ? "That public address is reserved. Choose another URL."
          : "The profile could not be saved. A published page needs an introduction and at least one contact method.",
    };
  refresh();
  return { ok: true, message: "Clinic profile saved." };
}
export async function setClinicPublished(
  input: unknown,
): Promise<ActionResult> {
  const parsed = z.boolean().safeParse(input);
  const access = await admin();
  if (!access || !parsed.success)
    return {
      ok: false,
      message: "Only a clinic administrator can publish this page.",
    };
  const db = await createClient();
  const { data, error } = await db
    .from("clinic_profiles")
    .update({ published: parsed.data })
    .eq("organization_id", access.org)
    .select("slug")
    .maybeSingle();
  if (error || !data)
    return {
      ok: false,
      message:
        "Save the profile with an introduction of at least 20 characters and one contact method before publishing.",
    };
  refresh();
  return {
    ok: true,
    message: parsed.data
      ? "Your clinic page is now public."
      : "Your clinic page and its gallery are now offline.",
  };
}
export async function preparePublication(
  input: unknown,
): Promise<ActionResult> {
  const parsed = publicationSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the public result.",
    };
  const access = await admin();
  if (!access)
    return {
      ok: false,
      message: "Only a clinic administrator can prepare public results.",
    };
  const db = await createClient();
  const { data: profile } = await db
    .from("clinic_profiles")
    .select("slug")
    .eq("organization_id", access.org)
    .maybeSingle();
  if (!profile)
    return { ok: false, message: "Save your clinic profile first." };
  const { data: source, error } = await db
    .from("clinic_gallery_entries")
    .select("before_path,after_path")
    .eq("organization_id", access.org)
    .eq("id", parsed.data.comparisonId)
    .eq("entry_kind", "clinical")
    .maybeSingle();
  if (error || !source?.before_path || !source.after_path)
    return {
      ok: false,
      message:
        "That clinic comparison is not available. Reference demos cannot be published as clinic results.",
    };
  const id = randomUUID();
  const uploaded: string[] = [];
  try {
    for (const [side, path] of [
      ["before", source.before_path],
      ["after", source.after_path],
    ]) {
      const original = await db.storage.from("clinical-photos").download(path);
      if (original.error || !original.data) throw new Error();
      const bytes = await sharp(
        Buffer.from(await original.data.arrayBuffer()),
        { limitInputPixels: 40000000 },
      )
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
      const target = `${access.org}/results/${id}/${side}.webp`;
      const { error } = await db.storage
        .from("clinic-showcase")
        .upload(target, bytes, {
          contentType: "image/webp",
          upsert: false,
          cacheControl: "0",
        });
      if (error) throw new Error();
      uploaded.push(target);
    }
    const v = parsed.data;
    const { error } = await db.rpc("prepare_clinic_publication", {
      payload: {
        id,
        organization_id: access.org,
        slug: publicSlug(v.title, id),
        title: v.title,
        category: v.category,
        procedure_type: v.procedure,
        body_area: v.bodyArea,
        summary: v.summary,
        treatment_interval: v.interval,
        before_path: uploaded[0],
        after_path: uploaded[1],
        comparison_id: v.comparisonId,
        consent_reference: v.consentReference,
      },
    });
    if (error) throw new Error();
    refresh();
    return {
      ok: true,
      message:
        "Public result prepared privately. Preview it below, then publish when ready.",
    };
  } catch {
    if (uploaded.length)
      await db.storage.from("clinic-showcase").remove(uploaded);
    return {
      ok: false,
      message:
        "The public result could not be prepared. Your private originals remain unchanged.",
    };
  }
}
export async function setResultPublished(
  input: unknown,
): Promise<ActionResult> {
  const parsed = z
    .object({
      id: z.uuid(),
      published: z.boolean(),
      revoke: z.boolean().optional(),
    })
    .safeParse(input);
  const access = await admin();
  if (!access || !parsed.success)
    return {
      ok: false,
      message: "Only a clinic administrator can change public results.",
    };
  const db = await createClient();
  if (parsed.data.revoke) {
    const { data: media } = await db
      .from("clinic_showcase_results")
      .select("before_path,after_path")
      .eq("id", parsed.data.id)
      .eq("organization_id", access.org)
      .maybeSingle();
    if (!media)
      return { ok: false, message: "That public result is unavailable." };
    const { data, error } = await db
      .from("clinic_publication_permissions")
      .update({
        revoked_at: new Date().toISOString(),
        confirmed_by: access.user,
      })
      .eq("result_id", parsed.data.id)
      .eq("organization_id", access.org)
      .select("result_id")
      .maybeSingle();
    if (error || !data)
      return { ok: false, message: "The permission could not be withdrawn." };
    const cleanup = await db.storage
      .from("clinic-showcase")
      .remove([media.before_path, media.after_path]);
    if (cleanup.error)
      return {
        ok: false,
        message:
          "Permission was withdrawn. Repeat this action to retry removal of the public web copies.",
      };
  } else {
    const { data, error } = await db
      .from("clinic_showcase_results")
      .update({ published: parsed.data.published })
      .eq("id", parsed.data.id)
      .eq("organization_id", access.org)
      .select("id")
      .maybeSingle();
    if (error || !data)
      return {
        ok: false,
        message:
          "This result could not be published. It needs active public marketing permission.",
      };
  }
  refresh();
  return {
    ok: true,
    message: parsed.data.revoke
      ? "Permission withdrawn and public result removed."
      : parsed.data.published
        ? "Result published."
        : "Result unpublished.",
  };
}
