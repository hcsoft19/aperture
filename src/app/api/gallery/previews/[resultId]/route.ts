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
  request: Request,
  { params }: { params: Promise<{ resultId: string }> },
) {
  try {
    const { resultId } = await params;
    const side = new URL(request.url).searchParams.get("side") ?? "before";
    const workspace = await getWorkspace();
    if (workspace?.kind !== "staff" || !workspace.activeMembership)
      return new Response("Not available", { status: 403, headers });
    if (
      !z.string().uuid().safeParse(resultId).success ||
      !["before", "after"].includes(side)
    )
      return new Response("Not available", { status: 404, headers });
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("clinic_gallery_entries")
      .select("before_path,after_path")
      .eq("id", resultId)
      .eq("organization_id", workspace.activeMembership.organizationId)
      .maybeSingle();
    const path = side === "before" ? data?.before_path : data?.after_path;
    if (error || !path)
      return new Response("Not available", { status: 404, headers });
    const original = await supabase.storage
      .from("clinical-photos")
      .download(path);
    if (original.error || !original.data)
      return new Response("Preview unavailable", { status: 503, headers });
    const thumbnail = await sharp(
      Buffer.from(await original.data.arrayBuffer()),
      { limitInputPixels: 40000000 },
    )
      .rotate()
      .resize({
        width: 720,
        height: 720,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .toBuffer();
    return new Response(new Uint8Array(thumbnail), {
      headers: { ...headers, "Content-Type": "image/webp" },
    });
  } catch {
    return new Response("Preview unavailable", { status: 503, headers });
  }
}
