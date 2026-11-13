import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { getWorkspace } from "@/features/access/workspace";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <ProtectedWorkspace>{children}</ProtectedWorkspace>
    </Suspense>
  );
}

async function ProtectedWorkspace({ children }: { children: ReactNode }) {
  await connection();
  const workspace = await getWorkspace();

  if (!workspace) {
    redirect("/login");
  }

  return <AppShell workspace={workspace}>{children}</AppShell>;
}

function WorkspaceFallback() {
  return (
    <div className="min-h-dvh bg-background px-4 py-8">
      <p className="text-sm text-muted-foreground" role="status">
        Loading workspace…
      </p>
    </div>
  );
}
