import type { Metadata } from "next";
import Link from "next/link";

import { AuthFrame } from "@/components/layout/auth-frame";
import { RegisterForm } from "@/features/auth/register-form";

export const metadata: Metadata = {
  title: "Create account",
};

export default function RegisterPage() {
  return (
    <AuthFrame
      title="Create account"
      description="Start a professional sign-in. Clinic setup comes after this step."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthFrame>
  );
}
