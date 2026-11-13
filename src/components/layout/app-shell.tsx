import Link from "next/link";
import type { ReactNode } from "react";

import { BottomNav } from "@/components/layout/bottom-nav";
import { SideNav } from "@/components/layout/side-nav";
import type { Workspace } from "@/features/access/workspace";
import { APP_NAME } from "@/lib/brand";

type AppShellProps = {
  workspace: Workspace;
  children: ReactNode;
};

export function AppShell({ workspace, children }: AppShellProps) {
  const contextLabel =
    workspace.kind === "staff"
      ? (workspace.activeMembership?.organizationName ?? "Clinic")
      : workspace.kind === "patient"
        ? "Your records"
        : "Set up your clinic";
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-card px-4 py-6 lg:block">
          <Link href="/home" className="mb-8 block px-3 text-lg font-semibold tracking-tight">
            {APP_NAME}
          </Link>
          <SideNav kind={workspace.kind} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3 lg:px-8">
            <Link href="/home" className="text-lg font-semibold tracking-tight lg:hidden">
              {APP_NAME}
            </Link>
            <p className="hidden text-sm text-muted-foreground lg:block">{contextLabel}</p>
            <p className="max-w-[60%] truncate text-sm text-muted-foreground">
              {workspace.user.email ?? "Signed in"}
            </p>
          </header>
          <div className="flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-10">{children}</div>
        </div>
      </div>
      <BottomNav kind={workspace.kind} />
    </div>
  );
}
