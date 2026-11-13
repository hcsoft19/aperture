"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { setComparisonShareAction, setSessionReleaseAction } from "@/features/sharing/actions";

export function ReleaseButton({ sessionId, released }: { sessionId: string; released: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const result = await setSessionReleaseAction({ sessionId, released: !released });
        setMessage(result.message);
        setPending(false);
        if (result.ok) {
          window.location.reload();
        }
      }}
    >
      <Button type="submit" size="lg" variant="outline" disabled={pending}>
        {released ? "Hide session" : "Release session"}
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}

export function ShareButton({ comparisonId, shared }: { comparisonId: string; shared: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const result = await setComparisonShareAction({ comparisonId, shared: !shared });
        setMessage(result.message);
        setPending(false);
        if (result.ok) {
          window.location.reload();
        }
      }}
    >
      <Button type="submit" size="lg" variant="outline" disabled={pending}>
        {shared ? "Hide comparison" : "Share comparison"}
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}
