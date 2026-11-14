import { describe, expect, it } from "vitest";

import {
  collaborationActions,
  can,
  roleLabel,
  type CollaborationAction,
} from "@/features/collaboration/permissions";

const matrix: Record<"clinic_admin" | "professional", Record<CollaborationAction, boolean>> = {
  clinic_admin: {
    manage_templates: true,
    manage_members: true,
    release_to_patient: true,
    capture: true,
    edit_chart: true,
  },
  professional: {
    manage_templates: false,
    manage_members: false,
    release_to_patient: true,
    capture: true,
    edit_chart: true,
  },
};

describe("collaboration permissions", () => {
  it("covers every collaboration action", () => {
    expect(collaborationActions).toEqual([
      "manage_templates",
      "manage_members",
      "release_to_patient",
      "capture",
      "edit_chart",
    ]);
  });

  it.each(["clinic_admin", "professional"] as const)(
    "matches the permission matrix for %s",
    (role) => {
      for (const action of collaborationActions) {
        expect(can(role, action)).toBe(matrix[role][action]);
      }
    },
  );

  it("lets a clinic administrator do everything a professional cannot manage", () => {
    expect(can("clinic_admin", "manage_templates")).toBe(true);
    expect(can("clinic_admin", "manage_members")).toBe(true);
    expect(can("professional", "manage_templates")).toBe(false);
    expect(can("professional", "manage_members")).toBe(false);
    expect(can("professional", "capture")).toBe(true);
    expect(can("professional", "edit_chart")).toBe(true);
    expect(can("professional", "release_to_patient")).toBe(true);
  });

  it("denies every action to an unknown role", () => {
    for (const role of ["patient", "owner", "CLINIC_ADMIN", ""]) {
      for (const action of collaborationActions) {
        expect(can(role, action)).toBe(false);
      }
    }
  });

  it("denies an unknown action", () => {
    expect(can("clinic_admin", "delete_clinic")).toBe(false);
    expect(can("professional", "manage_templates ")).toBe(false);
  });
});

describe("role labels", () => {
  it("uses plain language for known roles", () => {
    expect(roleLabel("clinic_admin")).toBe("Clinic administrator");
    expect(roleLabel("professional")).toBe("Professional");
  });

  it("does not echo an unknown role", () => {
    expect(roleLabel("owner")).toBe("Unknown role");
  });
});
