"use server";

import { recordDeletionRequest } from "@/features/privacy-requests/requests";
import { getWorkspace } from "@/features/access/workspace";
import { isUuid } from "@/lib/ids";
import { createClient } from "@/lib/supabase/server";

export type ReadinessActionState = { message: string } | null;

export async function recordDeletionRequestAction(
  _previous: ReadinessActionState,
  formData: FormData,
): Promise<ReadinessActionState> {
  const patientId = formData.get("patientId");
  if (typeof patientId !== "string" || !isUuid(patientId)) {
    return { message: "This request could not be prepared." };
  }

  const workspace = await getWorkspace();
  if (
    !workspace ||
    workspace.kind !== "staff" ||
    workspace.activeMembership?.role !== "clinic_admin"
  ) {
    return { message: "Only a clinic administrator can make this request." };
  }

  const decision = recordDeletionRequest(
    {
      profileId: workspace.user.id,
      organizationId: workspace.activeMembership.organizationId,
      role: "clinic_admin",
    },
    {
      patientId,
      organizationId: workspace.activeMembership.organizationId,
    },
  );

  if (!decision.ok) {
    return { message: decision.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_privacy_request", {
    target_patient: patientId,
    kind: "deletion",
  });

  if (error) {
    return { message: "The deletion request could not be recorded." };
  }

  return { message: decision.message };
}
