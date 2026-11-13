import { describe, expect, it } from "vitest";

import { resolveWorkspaceKind } from "@/features/access/kind";
import { navigationFor } from "@/features/navigation/config";

describe("workspace kind", () => {
  it("asks a new account to create a clinic", () => {
    expect(resolveWorkspaceKind(0, 0)).toBe("needs_clinic");
  });

  it("keeps a staff member in the clinic even if they are also a patient", () => {
    expect(resolveWorkspaceKind(1, 1)).toBe("staff");
  });

  it("uses the patient shell when there is no clinic membership", () => {
    expect(resolveWorkspaceKind(0, 2)).toBe("patient");
  });
});

describe("navigation", () => {
  it("hides capture from patients", () => {
    expect(navigationFor("patient").map((item) => item.href)).toEqual([
      "/home",
      "/treatments",
      "/profile",
    ]);
  });

  it("shows the clinic tools to staff", () => {
    expect(navigationFor("staff").map((item) => item.label)).toEqual([
      "Home",
      "Patients",
      "Capture",
      "Profile",
    ]);
  });
});
