import "server-only";

import { redirect } from "next/navigation";

import { getWorkspace } from "@/features/access/workspace";

export type StaffChartContext =
  | { ok: false; message: string }
  | { ok: true; organizationId: string; clinicName: string };

export async function staffChartContext(): Promise<StaffChartContext> {
  const workspace = await getWorkspace();

  if (!workspace) {
    redirect("/login");
  }

  if (workspace.kind === "patient") {
    return {
      ok: false,
      message: "Patient charts are limited to professionals in a clinic.",
    };
  }

  if (workspace.kind !== "staff" || !workspace.activeMembership) {
    return {
      ok: false,
      message: "Create a clinic before opening patient charts.",
    };
  }

  return {
    ok: true,
    organizationId: workspace.activeMembership.organizationId,
    clinicName: workspace.activeMembership.organizationName,
  };
}
