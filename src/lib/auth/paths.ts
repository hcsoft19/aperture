const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/robots.txt",
  "/sitemap.xml",
]);

const PUBLIC_PREFIXES = ["/auth/", "/clinics/", "/api/clinic/branding/"];

const AUTH_ENTRY_PATHS = new Set(["/login", "/register", "/forgot-password"]);

export function isPublicPath(pathname: string) {
  if (PUBLIC_EXACT_PATHS.has(pathname)) {
    return true;
  }

  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isAuthEntryPath(pathname: string) {
  return AUTH_ENTRY_PATHS.has(pathname);
}

/** Allows only same-origin relative paths, so redirects cannot leave the app. */
export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/home";
  }

  if (value.startsWith("/\\") || value.includes("://")) {
    return "/home";
  }

  return value;
}
