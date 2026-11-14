import {
  getPublicClinic,
  getPublicResult,
  createPublicClient,
} from "@/features/clinic-showcase/queries";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ slug: string; resultSlug: string; side: string }> },
) {
  try {
    const p = await params;
    if (!["before", "after"].includes(p.side))
      return new Response("Not available", { status: 404, headers });
    const clinic = await getPublicClinic(p.slug);
    if (!clinic) return new Response("Not available", { status: 404, headers });
    const result = await getPublicResult(clinic.organization_id, p.resultSlug);
    if (!result) return new Response("Not available", { status: 404, headers });
    const path = p.side === "before" ? result.before_path : result.after_path;
    const image = await createPublicClient()
      .storage.from("clinic-showcase")
      .download(path);
    return image.data
      ? new Response(image.data, {
          headers: { ...headers, "Content-Type": "image/webp" },
        })
      : new Response("Not available", { status: 404, headers });
  } catch {
    return new Response("Image unavailable", { status: 503, headers });
  }
}
