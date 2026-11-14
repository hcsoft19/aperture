import { readBranding } from "@/features/clinic-showcase/branding";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string; kind: string }> },
) {
  const p = await params;
  return readBranding(p.organizationId, p.kind);
}
