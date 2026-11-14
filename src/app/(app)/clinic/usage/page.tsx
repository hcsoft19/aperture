import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getWorkspace } from "@/features/access/workspace";
import { ChartMessage } from "@/features/patients/chart-message";
import { PROTOTYPE_STORAGE_LIMIT_BYTES } from "@/features/clinic-usage/usage";
import { storageStatus } from "@/features/production-readiness/storage";

export const metadata = {
  title: "Storage",
  robots: { index: false, follow: false },
};

export default function ClinicStoragePage() {
  return (
    <Suspense fallback={<p className="text-base">Loading storage…</p>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const workspace = await getWorkspace();
  if (!workspace) {
    redirect("/login");
  }
  if (workspace.kind !== "staff" || !workspace.activeMembership) {
    return <ChartMessage title="Storage" message="Storage is limited to clinic staff." />;
  }

  const usage = await storageStatus(workspace.activeMembership.organizationId);
  if (!usage) {
    return <ChartMessage title="Storage" message="Storage use could not be checked." />;
  }

  const limit = formatBytes(PROTOTYPE_STORAGE_LIMIT_BYTES);
  const used = formatBytes(usage.usedBytes);
  const label = usage.status === "ok" ? "Within the limit" : usage.status === "warning" ? "Near the limit" : "Over the limit";

  return (
    <section className="flex max-w-xl flex-col gap-4">
      <h1 className="text-3xl">Storage</h1>
      <p className="text-base">This clinic is on the prototype plan. Paid billing is not available.</p>
      <p className="text-base" role="status">
        {label}. {used} of {limit} is stored.
        {usage.unknownSizeCount > 0 ? ` ${usage.unknownSizeCount} photographs have no recorded size.` : ""}
      </p>
      <p className="text-base">A full limit refuses a new photograph. Stored originals are not deleted.</p>
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1_000_000) {
    return `${Math.round(bytes / 1000)} KB`;
  }
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
