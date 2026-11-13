import Link from "next/link";
import { Aperture, ShieldCheck } from "lucide-react";
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
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px]">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card px-5 py-8 lg:block">
          <Link href="/home" className="mb-10 flex min-h-11 items-center gap-2.5 px-3 text-2xl font-semibold tracking-[-0.05em]">
            <Aperture aria-hidden="true" className="size-7 text-primary" />{APP_NAME}.
          </Link>
          <p className="eyebrow mb-4 px-3 text-muted-foreground">Workspace</p>
          <SideNav kind={workspace.kind} />
          <div className="mt-12 rounded-2xl bg-secondary p-4"><ShieldCheck aria-hidden="true" className="mb-3 size-5 text-primary" /><p className="text-base font-medium">Care in every detail.</p><p className="mt-2 text-sm leading-6 text-muted-foreground">A dedicated space for your clinic’s patient stories.</p></div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-5 lg:px-10">
            <Link href="/home" className="flex min-h-11 items-center gap-2 text-xl font-semibold tracking-[-0.05em] lg:hidden">
              <Aperture aria-hidden="true" className="size-6 text-primary" />{APP_NAME}.
            </Link>
            <p className="hidden text-sm text-muted-foreground lg:block">{contextLabel}</p>
            <p className="max-w-[60%] truncate text-sm text-muted-foreground">
              {workspace.user.email ?? "Signed in"}
            </p>
          </header>
          <div className="flex-1 px-5 py-8 pb-28 sm:px-8 lg:px-10 lg:py-10 lg:pb-12">{children}</div>
        </div>
      </div>
      <BottomNav kind={workspace.kind} />
    </div>
  );
}
