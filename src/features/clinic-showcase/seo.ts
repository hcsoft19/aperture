import type { Metadata } from "next";
import type { ClinicProfile, PublicResult } from "./models";
import { safeExternalUrl, socialPlatforms } from "./models";
import { siteOrigin } from "./site-url";
export function clinicMetadata(
  profile: ClinicProfile,
  result?: PublicResult,
  page = 1,
  filtered = false,
): Metadata {
  const origin = siteOrigin();
  const path = `/clinics/${profile.slug}${result ? `/results/${result.slug}` : page > 1 ? `?page=${page}` : ""}`;
  const title = result
    ? `${result.title} | ${profile.display_name}`
    : `${profile.display_name}${profile.city ? ` | ${profile.city}` : ""}`;
  const description = (result?.summary || profile.introduction).slice(0, 160);
  const image = result
    ? `${origin}/clinics/${profile.slug}/results/${result.slug}/media/before`
    : profile.cover_path
      ? `${origin}/api/clinic/branding/${profile.organization_id}/cover`
      : profile.logo_path
        ? `${origin}/api/clinic/branding/${profile.organization_id}/logo`
        : undefined;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: origin + path },
    robots: { index: profile.allow_indexing && !filtered, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      url: origin + path,
      siteName: profile.display_name,
      ...(image
        ? {
            images: [
              { url: image, alt: result?.title || profile.display_name },
            ],
          }
        : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
export function clinicStructuredData(profile: ClinicProfile) {
  const socials =
    profile.social_links &&
    typeof profile.social_links === "object" &&
    !Array.isArray(profile.social_links)
      ? profile.social_links
      : {};
  return {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: profile.display_name,
    url: `${siteOrigin()}/clinics/${profile.slug}`,
    description: profile.introduction,
    ...(profile.phone ? { telephone: profile.phone } : {}),
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.address || profile.city
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: profile.address,
            addressLocality: profile.city,
            addressRegion: profile.region,
            postalCode: profile.postal_code,
            addressCountry: profile.country,
          },
        }
      : {}),
    ...(profile.logo_path
      ? {
          image: `${siteOrigin()}/api/clinic/branding/${profile.organization_id}/logo`,
        }
      : {}),
    sameAs: [
      safeExternalUrl(profile.website),
      ...socialPlatforms.map((k) =>
        typeof socials[k] === "string"
          ? safeExternalUrl(socials[k] as string)
          : "",
      ),
    ].filter(Boolean),
  };
}
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
