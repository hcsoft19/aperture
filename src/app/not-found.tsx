import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-base leading-7 text-muted-foreground">
        This page may have moved or is no longer available.
      </p>
      <Link
        href="/"
        className={buttonVariants({ size: "lg", className: "w-fit" })}
      >
        Back to start
      </Link>
    </div>
  );
}
