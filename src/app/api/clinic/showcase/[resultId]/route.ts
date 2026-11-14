import { getWorkspace } from "@/features/access/workspace";
import { createClient } from "@/lib/supabase/server";
import { mediaHeaders } from "@/features/clinic-showcase/branding";
import { z } from "zod";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ resultId: string }> },
) {
  const w = await getWorkspace();
  if (w?.kind !== "staff" || w.activeMembership?.role !== "clinic_admin")
    return new Response("Not available", {
      status: 403,
      headers: mediaHeaders,
    });
  const { resultId } = await params;
  const side = new URL(request.url).searchParams.get("side");
  if (
    !z.uuid().safeParse(resultId).success ||
    !["before", "after"].includes(side ?? "")
  )
    return new Response("Not available", {
      status: 404,
      headers: mediaHeaders,
    });
  const db = await createClient();
  const { data } = await db
    .from("clinic_showcase_results")
    .select("before_path,after_path")
    .eq("id", resultId)
    .eq("organization_id", w.activeMembership.organizationId)
    .maybeSingle();
  const path = side === "before" ? data?.before_path : data?.after_path;
  if (!path)
    return new Response("Not available", {
      status: 404,
      headers: mediaHeaders,
    });
  const image = await db.storage.from("clinic-showcase").download(path);
  return image.data
    ? new Response(image.data, {
        headers: { ...mediaHeaders, "Content-Type": "image/webp" },
      })
    : new Response("Not available", { status: 404, headers: mediaHeaders });
}
