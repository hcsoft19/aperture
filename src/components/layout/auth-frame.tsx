import Link from "next/link";
import { Aperture, ArrowLeft } from "lucide-react";
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
    <div className="flex min-h-dvh flex-col bg-muted/50">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-card px-5 py-5 sm:px-10">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 text-2xl font-semibold tracking-[-0.05em]">
          <Aperture aria-hidden="true" className="size-7 text-primary" />{APP_NAME}.
        </Link>
        <Link href="/" className="flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary"><ArrowLeft aria-hidden="true" className="size-4" />Back to home</Link>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
        <div className="rounded-2xl border border-border bg-card p-7 shadow-sm shadow-primary/5 sm:p-9">
          <p className="eyebrow mb-4 text-primary">Your practice, connected</p>
          <h1 className="editorial-title text-4xl">{title}</h1>
          <p className="mt-2 text-base leading-7 text-muted-foreground">{description}</p>
          <div className="mt-6">{children}</div>
        </div>
        <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>
      </div>
    </div>
  );
}
