import { describe, expect, it } from "vitest";

import { patientSearchFilter, patientSearchTerm } from "@/features/patients/search";
import { patientSchema, treatmentSchema } from "@/features/patients/schemas";

describe("patient charts", () => {
  it("accepts a chart with a name only", () => {
    expect(
      patientSchema.safeParse({
        firstName: "Sam",
        lastName: "Rivera",
        dateOfBirth: "",
        contactEmail: "",
        phone: "",
      }).success,
    ).toBe(true);
  });

  it("rejects a future date of birth", () => {
    expect(
      patientSchema.safeParse({
        firstName: "Sam",
        lastName: "Rivera",
        dateOfBirth: "2999-01-01",
        contactEmail: "",
        phone: "",
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid contact email", () => {
    expect(
      patientSchema.safeParse({
        firstName: "Sam",
        lastName: "Rivera",
        dateOfBirth: "",
        contactEmail: "not-an-email",
        phone: "",
      }).success,
    ).toBe(false);
  });
});

describe("treatments", () => {
  it("requires a name, category, and body area", () => {
    expect(
      treatmentSchema.safeParse({
        name: "",
        category: "Laser",
        bodyArea: "Face",
        description: "",
        startDate: "",
        status: "planned",
      }).success,
    ).toBe(false);
  });
});

describe("patient search", () => {
  it("strips filter characters from the query", () => {
    expect(patientSearchTerm('Sam%,(Rivera)')).toBe("Sam Rivera");
  });

  it("matches a single name against either column", () => {
    expect(patientSearchFilter("Riv")).toBe(
      'first_name.ilike."%Riv%",last_name.ilike."%Riv%"',
    );
  });

  it("matches a full name in either order", () => {
    expect(patientSearchFilter("Sam Rivera")).toContain('first_name.ilike."%Sam%"');
    expect(patientSearchFilter("Sam Rivera")).toContain('last_name.ilike."%Rivera%"');
  });
});
