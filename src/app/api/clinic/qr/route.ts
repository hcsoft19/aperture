import QRCode from "qrcode";
import { getWorkspace } from "@/features/access/workspace";
import { getStaffClinicProfile } from "@/features/clinic-showcase/queries";
import { siteOrigin } from "@/features/clinic-showcase/site-url";
export async function GET() {
  const w = await getWorkspace();
  if (w?.kind !== "staff" || !w.activeMembership)
    return new Response("Not available", { status: 403 });
  const profile = await getStaffClinicProfile(
    w.activeMembership.organizationId,
  );
  if (!profile) return new Response("Not available", { status: 404 });
  const bytes = await QRCode.toBuffer(
    `${siteOrigin()}/clinics/${profile.slug}`,
    {
      type: "png",
      width: 1024,
      margin: 4,
      errorCorrectionLevel: "M",
      color: { dark: "#713e53", light: "#ffffff" },
    },
  );
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="clinic-qr.png"',
    },
  });
}
