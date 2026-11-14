export function siteOrigin() {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    if (value) {
      const url = new URL(value);
      if (url.protocol === "https:" || url.hostname === "localhost")
        return url.origin;
    }
  } catch {}
  return "https://aperture-hcsoft19-gmailcoms-projects.vercel.app";
}
