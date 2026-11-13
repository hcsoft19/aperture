import type { Metadata } from "next";
import Link from "next/link";

import { AuthFrame } from "@/components/layout/auth-frame";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthFrame
      title="Reset password"
      description="We will email a link if this address has an account."
      footer={
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthFrame>
  );
}
