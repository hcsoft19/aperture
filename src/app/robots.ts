import type { MetadataRoute } from "next";
import { siteOrigin } from "@/features/clinic-showcase/site-url";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/clinics/"],
      disallow: [
        "/home",
        "/patients",
        "/capture",
        "/profile",
        "/clinic/",
        "/results/",
        "/treatments",
        "/invite/",
        "/api/gallery/",
        "/api/clinic/showcase/",
      ],
    },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
