import { z } from "zod";
import type { Database } from "@/types/database";
export type ClinicProfile =
  Database["public"]["Tables"]["clinic_profiles"]["Row"];
export type PublicResult =
  Database["public"]["Tables"]["clinic_showcase_results"]["Row"];
export const socialPlatforms = [
  "instagram",
  "facebook",
  "tiktok",
  "linkedin",
  "youtube",
] as const;
export function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
const external = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => !value || Boolean(safeExternalUrl(value)),
    "Use a full https:// URL without a username or password.",
  );
const short = z.string().trim().max(160);
export const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Use lowercase words separated by hyphens.",
  );
export function whatsappUrl(value: string) {
  if (!/^\+?[\d\s().-]+$/.test(value)) return "";
  const digits = value.replace(/\D/g, "");
  return /^[1-9]\d{6,14}$/.test(digits) ? `https://wa.me/${digits}` : "";
}
export const clinicProfileSchema = z
  .object({
    allow_indexing: z.boolean(),
    display_name: z.string().trim().min(2).max(120),
    slug: slugSchema,
    introduction: z.string().trim().max(2000),
    address: short,
    city: short,
    region: short,
    postal_code: z.string().trim().max(30),
    country: short,
    phone: z.string().trim().max(40),
    whatsapp: z
      .string()
      .trim()
      .max(40)
      .refine(
        (value) => !value || Boolean(whatsappUrl(value)),
        "Include the country code, for example +1 305 555 0100.",
      ),
    email: z
      .string()
      .trim()
      .max(320)
      .refine(
        (value) => !value || z.email().safeParse(value).success,
        "Enter a valid email address.",
      ),
    contact_name: short,
    website: external,
    instagram: external,
    facebook: external,
    tiktok: external,
    linkedin: external,
    youtube: external,
    specialties: z.string().trim().max(500),
    languages: z.string().trim().max(300),
    opening_hours: z.string().trim().max(600),
    booking_mode: z.enum(["none", "whatsapp", "external"]),
    booking_destination: external,
    booking_label: z.string().trim().min(2).max(60),
  })
  .superRefine((value, ctx) => {
    if (value.booking_mode === "whatsapp" && !whatsappUrl(value.whatsapp))
      ctx.addIssue({
        code: "custom",
        path: ["whatsapp"],
        message:
          "Add a WhatsApp number with country code to enable booking through WhatsApp.",
      });
    if (value.booking_mode === "external" && !value.booking_destination)
      ctx.addIssue({
        code: "custom",
        path: ["booking_destination"],
        message: "Enter your booking system’s https:// URL.",
      });
  });
export type ClinicProfileValues = z.infer<typeof clinicProfileSchema>;
export function profileValues(
  profile: ClinicProfile | null,
  name: string,
): ClinicProfileValues {
  const socials =
    profile?.social_links &&
    typeof profile.social_links === "object" &&
    !Array.isArray(profile.social_links)
      ? profile.social_links
      : {};
  return {
    allow_indexing: profile?.allow_indexing ?? true,
    display_name: profile?.display_name ?? name,
    slug: profile?.slug ?? "",
    introduction: profile?.introduction ?? "",
    address: profile?.address ?? "",
    city: profile?.city ?? "",
    region: profile?.region ?? "",
    postal_code: profile?.postal_code ?? "",
    country: profile?.country ?? "",
    phone: profile?.phone ?? "",
    whatsapp: profile?.whatsapp ?? "",
    email: profile?.email ?? "",
    contact_name: profile?.contact_name ?? "",
    website: profile?.website ?? "",
    specialties: profile?.specialties ?? "",
    languages: profile?.languages ?? "",
    opening_hours: profile?.opening_hours ?? "",
    ...(Object.fromEntries(
      socialPlatforms.map((key) => [
        key,
        typeof socials[key] === "string" ? socials[key] : "",
      ]),
    ) as Record<(typeof socialPlatforms)[number], string>),
    booking_mode: !profile?.booking_url
      ? "none"
      : profile.booking_url.startsWith("https://wa.me/")
        ? "whatsapp"
        : "external",
    booking_destination: profile?.booking_url ?? "",
    booking_label: profile?.booking_label ?? "Book a consultation",
  };
}
export const publicationSchema = z.object({
  comparisonId: z.uuid(),
  title: z.string().trim().min(3).max(120),
  category: z.string().trim().min(1).max(80),
  procedure: z.string().trim().max(80),
  bodyArea: z.string().trim().max(80),
  summary: z.string().trim().min(20).max(2000),
  interval: z.string().trim().max(120),
  consentReference: z.string().trim().min(5).max(240),
  confirmPermission: z
    .boolean()
    .refine((value) => value, "Confirm permission for public marketing use."),
});
export type PublicationValues = z.infer<typeof publicationSchema>;
export function publicSlug(title: string, id: string) {
  const words = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 65)
    .replace(/-$/g, "");
  return `${words || "result"}-${id.slice(0, 8)}`;
}
export function profileCompleteness(profile: ClinicProfile | null) {
  if (!profile) return 0;
  return Math.round(
    ([
      profile.display_name,
      profile.introduction,
      profile.logo_path,
      profile.address,
      profile.city,
      profile.phone || profile.email || profile.whatsapp,
      profile.specialties,
      profile.opening_hours,
    ].filter(Boolean).length /
      8) *
      100,
  );
}
