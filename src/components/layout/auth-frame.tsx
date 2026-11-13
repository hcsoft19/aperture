import Link from "next/link";
import type { ReactNode } from "react";

import { APP_NAME } from "@/lib/brand";

type AuthFrameProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthFrame({ title, description, children, footer }: AuthFrameProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background bg-[radial-gradient(ellipse_at_top_right,var(--secondary),transparent_65%)]">
      <header className="px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          {APP_NAME}
        </Link>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
        <div className="rounded-3xl border border-border bg-card p-7 shadow-xl shadow-primary/5 sm:p-9">
          <h1 className="editorial-title text-4xl">{title}</h1>
          <p className="mt-2 text-base leading-7 text-muted-foreground">{description}</p>
          <div className="mt-6">{children}</div>
        </div>
        <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
      </div>
    </div>
  );
}
