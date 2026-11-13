import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthFrame } from "@/components/layout/auth-frame";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Choose a new password",
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted-foreground">Loading…</p>}>
      <ResetPasswordScreen />
    </Suspense>
  );
}

async function ResetPasswordScreen() {
  await requireUser();

  return (
    <AuthFrame
      title="Choose a new password"
      description="Use at least 8 characters. This replaces the password on your account."
      footer={<span>You can keep using this device after saving.</span>}
    >
      <ResetPasswordForm />
    </AuthFrame>
  );
}
