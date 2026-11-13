"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { WorkspaceKind } from "@/features/access/kind";
import { navigationFor } from "@/features/navigation/config";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ kind }: { kind: WorkspaceKind }) {
  const pathname = usePathname();
  const items = navigationFor(kind);

  return (
    <nav aria-label="Workspace" className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-foreground hover:bg-muted",
            )}
          >
            <Icon aria-hidden="true" className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
