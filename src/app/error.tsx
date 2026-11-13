"use client";

import { Button } from "@/components/ui/button";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-base leading-7 text-muted-foreground">
        The page could not be loaded. Try again. If it continues, sign in once more.
      </p>
      <Button type="button" size="lg" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
