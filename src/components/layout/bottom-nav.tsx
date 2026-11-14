"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { WorkspaceKind } from "@/features/access/kind";
import { navigationFor } from "@/features/navigation/config";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav({ kind }: { kind: WorkspaceKind }) {
  const pathname = usePathname();
  const items = navigationFor(kind);
  const columns =
    items.length === 5
      ? "grid-cols-5"
      : items.length === 2
        ? "grid-cols-2"
        : items.length === 3
          ? "grid-cols-3"
          : "grid-cols-4";

  return (
    <nav
      aria-label="Workspace"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
    >
      <ul className={cn("mx-auto grid max-w-lg", columns)}>
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-2 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
