import { describe, it, expect } from "vitest";
import {
  clinicProfileSchema,
  profileValues,
  whatsappUrl,
  safeExternalUrl,
  publicationSchema,
  publicSlug,
} from "@/features/clinic-showcase/models";
import { jsonLd } from "@/features/clinic-showcase/seo";
describe("clinic public profile", () => {
  it("allows a profile without a booking button", () => {
    const values = {
      ...profileValues(null, "Demo clinic"),
      slug: "demo-clinic",
    };
    expect(clinicProfileSchema.safeParse(values).success).toBe(true);
    expect(values.booking_mode).toBe("none");
    expect(
      clinicProfileSchema.safeParse({ ...values, booking_label: "" }).success,
    ).toBe(true);
  });
  it("requires a valid destination only when booking is enabled", () => {
    const values = {
      ...profileValues(null, "Demo clinic"),
      slug: "demo-clinic",
      booking_mode: "external",
    };
    expect(clinicProfileSchema.safeParse(values).success).toBe(false);
    expect(
      clinicProfileSchema.safeParse({
        ...values,
        booking_destination: "https://book.example.com/clinic",
      }).success,
    ).toBe(true);
    expect(
      clinicProfileSchema.safeParse({
        ...values,
        booking_mode: "whatsapp",
        whatsapp: "+1 (305) 555-0100",
      }).success,
    ).toBe(true);
  });
  it("builds WhatsApp destinations without allowing arbitrary schemes", () => {
    expect(whatsappUrl("+1 (305) 555-0100")).toBe("https://wa.me/13055550100");
    expect(whatsappUrl("javascript:123456789")).toBe("");
    expect(safeExternalUrl("javascript:alert(1)")).toBe("");
    expect(safeExternalUrl("https://user:pass@example.com")).toBe("");
  });
  it("validates stable descriptive slugs", () => {
    expect(
      clinicProfileSchema.safeParse({
        ...profileValues(null, "Demo"),
        slug: "../patients",
      }).success,
    ).toBe(false);
    expect(publicSlug("Nose contour · profile", "12345678-abcd")).toBe(
      "nose-contour-profile-12345678",
    );
  });
  it("requires separate public marketing permission", () => {
    const value = {
      comparisonId: "03c8f330-1038-4209-815e-c650ea3992f4",
      title: "Demonstration result",
      category: "Demo",
      procedure: "",
      bodyArea: "Face",
      summary: "This is a fictional demonstration result.",
      interval: "",
      consentReference: "DEMO-PERMISSION-1",
      confirmPermission: false,
    };
    expect(publicationSchema.safeParse(value).success).toBe(false);
    expect(
      publicationSchema.safeParse({ ...value, confirmPermission: true })
        .success,
    ).toBe(true);
  });
  it("escapes script delimiters in structured data", () => {
    expect(
      jsonLd({ name: "</script><script>alert(1)</script>" }),
    ).not.toContain("</script>");
  });
});
