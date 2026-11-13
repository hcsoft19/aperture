"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invitePatientAction, revokeInvitationAction } from "@/features/sharing/actions";
import type { ChartInvitation } from "@/features/sharing/queries";

export function InvitePanel({
  patientId,
  linked,
  invitation,
}: {
  patientId: string;
  linked: boolean;
  invitation: ChartInvitation | null;
}) {
  const [email, setEmail] = useState(invitation?.email ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (linked) {
    return <p className="text-base text-muted-foreground">This chart is linked to a patient account.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <p className={link ? "text-sm text-muted-foreground" : "text-sm text-destructive"} role="status">
          {message}
        </p>
      ) : null}
      {link ? (
        <p className="break-all rounded-lg bg-muted px-3 py-3 text-base">
          <a href={link} className="font-medium text-primary">{link}</a>
        </p>
      ) : null}
      {invitation ? (
        <div className="flex flex-col gap-3">
          <p className="text-base">An invitation is open for {invitation.email}.</p>
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const result = await revokeInvitationAction(invitation.id);
              setMessage(result.message);
              setLink(null);
              setPending(false);
              if (result.ok) {
                window.location.reload();
              }
            }}
          >
            Revoke invitation
          </Button>
        </div>
      ) : (
        <form
          className="flex max-w-md flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setMessage(null);
            setLink(null);
            const result = await invitePatientAction({ patientId, email });
            setMessage(result.message);
            setLink(result.ok ? (result.link ?? null) : null);
            setPending(false);
          }}
        >
          <Label htmlFor="invite-email">Patient email</Label>
          <Input
            id="invite-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Creating…" : "Create invitation"}
          </Button>
        </form>
      )}
    </div>
  );
}
