import { describe, expect, it } from "vitest";

import { isAuthEntryPath, isPublicPath, safeNextPath } from "@/lib/auth/paths";

describe("route access", () => {
  it("keeps the marketing and auth screens public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/register")).toBe(true);
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/clinics/example-clinic")).toBe(true);
    expect(isPublicPath("/robots.txt")).toBe(true);
    expect(isPublicPath("/sitemap.xml")).toBe(true);
  });

  it("protects the workspace and password update screen", () => {
    expect(isPublicPath("/home")).toBe(false);
    expect(isPublicPath("/clinic")).toBe(false);
    expect(isPublicPath("/clinic/preview")).toBe(false);
    expect(isPublicPath("/api/clinic/branding")).toBe(false);
    expect(isPublicPath("/api/clinic/showcase/private-id")).toBe(false);
    expect(isPublicPath("/patients")).toBe(false);
    expect(isPublicPath("/capture")).toBe(false);
    expect(isPublicPath("/profile")).toBe(false);
    expect(isPublicPath("/reset-password")).toBe(false);
  });

  it("treats only sign-in screens as auth entries", () => {
    expect(isAuthEntryPath("/login")).toBe(true);
    expect(isAuthEntryPath("/home")).toBe(false);
  });

  it("rejects off-site redirect targets", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("https://evil.example")).toBe("/home");
    expect(safeNextPath("//evil.example")).toBe("/home");
    expect(safeNextPath(null)).toBe("/home");
  });
});
