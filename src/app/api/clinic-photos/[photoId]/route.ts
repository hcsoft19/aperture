import sharp from "sharp";
import { z } from "zod";
import { getWorkspace } from "@/features/access/workspace";
import { createClient } from "@/lib/supabase/server";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  const w = await getWorkspace();
  if (w?.kind !== "staff" || !w.activeMembership)
    return new Response("Not available", { status: 403, headers });
  const { photoId } = await params;
  if (!z.uuid().safeParse(photoId).success)
    return new Response("Not available", { status: 404, headers });
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("photos")
      .select(
        "storage_path,photo_sessions!inner(treatments!inner(patients!inner(organization_id)))",
      )
      .eq("id", photoId)
      .eq("upload_status", "uploaded")
      .eq(
        "photo_sessions.treatments.patients.organization_id",
        w.activeMembership.organizationId,
      )
      .maybeSingle();
    if (error || !data)
      return new Response("Not available", { status: 404, headers });
    const image = await db.storage
      .from("clinical-photos")
      .download(data.storage_path);
    if (image.error || !image.data)
      return new Response("Preview unavailable", { status: 503, headers });
    const bytes = await sharp(Buffer.from(await image.data.arrayBuffer()), {
      limitInputPixels: 40000000,
    })
      .rotate()
      .resize({
        width: 1000,
        height: 1000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
    return new Response(new Uint8Array(bytes), {
      headers: { ...headers, "Content-Type": "image/webp" },
    });
  } catch {
    return new Response("Preview unavailable", { status: 503, headers });
  }
}
