import { uploadBranding } from "@/features/clinic-showcase/branding";
export async function POST(request: Request) {
  return uploadBranding(request);
}
