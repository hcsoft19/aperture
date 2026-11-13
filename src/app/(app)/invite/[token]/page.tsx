import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getWorkspace } from "@/features/access/workspace";
import { AcceptInvite } from "@/features/portal/accept-invite";

export const metadata: Metadata = {
  title: "Invitation",
};

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default function InvitePage({ params }: InvitePageProps) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading invitation…</p>}>
      <InviteContent params={params} />
    </Suspense>
  );
}

async function InviteContent({ params }: InvitePageProps) {
  const workspace = await getWorkspace();
  if (!workspace) {
    redirect("/login");
  }

  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return (
      <section className="max-w-prose">
        <h1 className="text-2xl font-semibold tracking-tight">Invitation</h1>
        <p className="mt-3 text-base text-muted-foreground">This invitation is not available.</p>
      </section>
    );
  }

  return (
    <section className="flex max-w-prose flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Link your chart</h1>
      <p className="text-base leading-7 text-muted-foreground">
        Signed in as {workspace.user.email ?? "this account"}. The invitation works only for the email the clinic addressed.
      </p>
      <AcceptInvite token={token} />
      <Link href="/register" className="text-sm font-medium text-primary">
        Need a different account? Create one, then open this link again.
      </Link>
    </section>
  );
}
