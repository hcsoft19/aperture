import "server-only";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { getWorkspace } from "@/features/access/workspace";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
export const mediaHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};
export async function uploadBranding(request: Request) {
  const workspace = await getWorkspace();
  if (
    workspace?.kind !== "staff" ||
    workspace.activeMembership?.role !== "clinic_admin"
  )
    return Response.json(
      { message: "Administrator access required." },
      { status: 403 },
    );
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return Response.json({ message: "Request unavailable." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 2300000)
    return Response.json(
      { message: "Use an image smaller than 2 MB." },
      { status: 413 },
    );
  try {
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    if (
      !(file instanceof File) ||
      !file.size ||
      file.size > 2097152 ||
      !["logo", "cover"].includes(String(kind))
    )
      return Response.json(
        { message: "Choose a JPG, PNG, or WebP image smaller than 2 MB." },
        { status: 400 },
      );
    const db = await createClient();
    const org = workspace.activeMembership.organizationId;
    const { data: profile } = await db
      .from("clinic_profiles")
      .select("organization_id")
      .eq("organization_id", org)
      .maybeSingle();
    if (!profile)
      return Response.json(
        { message: "Save your clinic profile before adding images." },
        { status: 400 },
      );
    const source = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 20000000,
    });
    const metadata = await source.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format ?? "") ||
      (metadata.pages ?? 1) > 1
    )
      return Response.json(
        { message: "Choose a still JPG, PNG, or WebP image." },
        { status: 400 },
      );
    const bytes = await source
      .rotate()
      .resize({
        width: kind === "logo" ? 512 : 1800,
        height: kind === "logo" ? 512 : 1000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
    const path = `${org}/branding/${randomUUID()}.webp`;
    const { error } = await db.storage
      .from("clinic-showcase")
      .upload(path, bytes, {
        contentType: "image/webp",
        upsert: false,
        cacheControl: "0",
      });
    if (error) throw new Error();
    const { data, error: updateError } = await db
      .from("clinic_profiles")
      .update(kind === "logo" ? { logo_path: path } : { cover_path: path })
      .eq("organization_id", org)
      .select("organization_id")
      .maybeSingle();
    if (updateError || !data) {
      await db.storage.from("clinic-showcase").remove([path]);
      throw new Error();
    }
    return Response.json({
      message: `${kind === "logo" ? "Logo" : "Cover image"} saved.`,
      version: Date.now(),
    });
  } catch {
    return Response.json(
      { message: "The image could not be saved. Try a different image." },
      { status: 400 },
    );
  }
}
export async function readBranding(org: string, kind: string) {
  if (!z.uuid().safeParse(org).success || !["logo", "cover"].includes(kind))
    return new Response("Not available", {
      status: 404,
      headers: mediaHeaders,
    });
  const db = await createClient();
  const { data } = await db
    .from("clinic_profiles")
    .select("logo_path,cover_path")
    .eq("organization_id", org)
    .maybeSingle();
  const path = kind === "logo" ? data?.logo_path : data?.cover_path;
  if (!path)
    return new Response("Not available", {
      status: 404,
      headers: mediaHeaders,
    });
  const result = await db.storage.from("clinic-showcase").download(path);
  if (result.error || !result.data)
    return new Response("Not available", {
      status: 404,
      headers: mediaHeaders,
    });
  return new Response(result.data, {
    headers: { ...mediaHeaders, "Content-Type": "image/webp" },
  });
}
