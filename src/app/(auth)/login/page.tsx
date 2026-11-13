import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthFrame } from "@/components/layout/auth-frame";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <AuthFrame
      title="Sign in"
      description="Use the email and password for your professional account."
      footer={
        <>
          New to the clinic workspace?{" "}
          <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading sign in…</p>}>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
