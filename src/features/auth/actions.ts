"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordValues,
  type LoginValues,
  type RegisterValues,
  type ResetPasswordValues,
} from "@/features/auth/schemas";
import {
  SUPABASE_CONFIG_MESSAGE,
  toAuthErrorMessage,
} from "@/features/auth/messages";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type AuthActionResult =
  | { status: "error"; message: string }
  | { status: "success"; message: string };

function firstIssue(
  error: { issues: { message: string }[] },
  fallback: string,
) {
  return error.issues[0]?.message ?? fallback;
}

async function requestOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");

  if (origin) {
    return origin;
  }

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";

  if (host) {
    return `${proto}://${host}`;
  }

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signInAction(
  values: LoginValues,
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: firstIssue(parsed.error, "Check the form and try again."),
    };
  }

  if (!readSupabaseEnv()) {
    return { status: "error", message: SUPABASE_CONFIG_MESSAGE };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message: toAuthErrorMessage(
        error.code,
        "Email or password is incorrect.",
      ),
    };
  }

  redirect("/home");
}

export async function signUpAction(
  values: RegisterValues,
): Promise<AuthActionResult> {
  const parsed = registerSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: firstIssue(parsed.error, "Check the form and try again."),
    };
  }

  if (!readSupabaseEnv()) {
    return { status: "error", message: SUPABASE_CONFIG_MESSAGE };
  }

  const origin = await requestOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return {
      status: "error",
      message: toAuthErrorMessage(
        error.code,
        "The account could not be created. Try again.",
      ),
    };
  }

  if (data.session) {
    redirect("/home");
  }

  return {
    status: "success",
    message: "Account created. Check your email to confirm it before signing in.",
  };
}

export async function requestPasswordResetAction(
  values: ForgotPasswordValues,
): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: firstIssue(parsed.error, "Enter a valid email address."),
    };
  }

  if (!readSupabaseEnv()) {
    return { status: "error", message: SUPABASE_CONFIG_MESSAGE };
  }

  const origin = await requestOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return {
      status: "error",
      message: toAuthErrorMessage(
        error.code,
        "The reset email could not be sent. Try again.",
      ),
    };
  }

  return {
    status: "success",
    message: "If an account exists for that email, a reset link is on the way.",
  };
}

export async function updatePasswordAction(
  values: ResetPasswordValues,
): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse(values);

  if (!parsed.success) {
    return {
      status: "error",
      message: firstIssue(parsed.error, "Check the form and try again."),
    };
  }

  if (!readSupabaseEnv()) {
    return { status: "error", message: SUPABASE_CONFIG_MESSAGE };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message: toAuthErrorMessage(
        error.code,
        "The password could not be updated. Request a new reset link.",
      ),
    };
  }

  redirect("/home");
}

export async function signOutAction() {
  if (readSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
