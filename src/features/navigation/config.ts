import { Camera, ClipboardList, House, UserRound, Users, type LucideIcon } from "lucide-react";

import type { WorkspaceKind } from "@/features/access/kind";

export type NavItem = {
  href: "/home" | "/patients" | "/capture" | "/profile" | "/treatments";
  label: string;
  icon: LucideIcon;
};

const home = { href: "/home", label: "Home", icon: House } as const;
const patients = { href: "/patients", label: "Patients", icon: Users } as const;
const capture = { href: "/capture", label: "Capture", icon: Camera } as const;
const treatments = { href: "/treatments", label: "Treatments", icon: ClipboardList } as const;
const profile = { href: "/profile", label: "Profile", icon: UserRound } as const;

export function navigationFor(kind: WorkspaceKind): NavItem[] {
  if (kind === "staff") {
    return [home, patients, capture, profile];
  }

  if (kind === "patient") {
    return [home, treatments, profile];
  }

  return [home, profile];
}
