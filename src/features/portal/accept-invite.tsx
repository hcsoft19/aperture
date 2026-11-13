"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { acceptInvitationAction } from "@/features/sharing/actions";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {message ? <p className="text-sm text-destructive" role="alert">{message}</p> : null}
      <Button
        type="button"
        size="lg"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const result = await acceptInvitationAction(token);
          if (result.ok) {
            router.push("/treatments");
            router.refresh();
            return;
          }
          setMessage(result.message);
          setPending(false);
        }}
      >
        {pending ? "Linking…" : "Link this chart"}
      </Button>
    </div>
  );
}
