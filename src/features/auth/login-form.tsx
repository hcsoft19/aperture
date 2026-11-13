"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "@/features/auth/actions";
import { PasswordField } from "@/features/auth/password-field";
import { loginSchema, type LoginValues } from "@/features/auth/schemas";

const CONFIG_BANNER =
  "Supabase is not configured yet. Add the environment variables in .env.local, then restart the dev server.";

export function LoginForm() {
  const searchParams = useSearchParams();
  const configError = searchParams.get("error") === "config";
  const authError = searchParams.get("error") === "auth";
  const [serverMessage, setServerMessage] = useState<string | null>(
    authError ? "The sign-in link could not be confirmed. Try again." : null,
  );

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerMessage(null);
    const result = await signInAction(values);
    if (result?.status === "error") {
      setServerMessage(result.message);
    }
  });

  const emailError = form.formState.errors.email?.message;

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
      {configError ? (
        <p className="rounded-lg bg-accent px-3 py-3 text-sm text-accent-foreground" role="status">
          {CONFIG_BANNER}
        </p>
      ) : null}
      {serverMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {serverMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "email-error" : undefined}
          {...form.register("email")}
        />
        {emailError ? (
          <p id="email-error" className="text-sm text-destructive" role="alert">
            {emailError}
          </p>
        ) : null}
      </div>

      <PasswordField
        id="password"
        label="Password"
        autoComplete="current-password"
        error={form.formState.errors.password?.message}
        registration={form.register("password")}
      />

      <div className="flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
