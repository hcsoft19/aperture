"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpAction } from "@/features/auth/actions";
import { PasswordField } from "@/features/auth/password-field";
import { registerSchema, type RegisterValues } from "@/features/auth/schemas";

export function RegisterForm() {
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<"error" | "success" | null>(
    null,
  );

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerMessage(null);
    setServerStatus(null);
    const result = await signUpAction(values);
    if (result) {
      setServerStatus(result.status);
      setServerMessage(result.message);
    }
  });

  const emailError = form.formState.errors.email?.message;

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
      {serverMessage ? (
        <p
          className={
            serverStatus === "success"
              ? "text-sm text-foreground"
              : "text-sm text-destructive"
          }
          role={serverStatus === "success" ? "status" : "alert"}
        >
          {serverMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "register-email-error" : undefined}
          {...form.register("email")}
        />
        {emailError ? (
          <p id="register-email-error" className="text-sm text-destructive" role="alert">
            {emailError}
          </p>
        ) : null}
      </div>

      <PasswordField
        id="register-password"
        label="Password"
        autoComplete="new-password"
        error={form.formState.errors.password?.message}
        registration={form.register("password")}
      />
      <PasswordField
        id="register-confirm"
        label="Confirm password"
        autoComplete="new-password"
        error={form.formState.errors.confirmPassword?.message}
        registration={form.register("confirmPassword")}
      />

      <p className="text-sm leading-6 text-muted-foreground">
        This creates a sign-in only. You name the clinic on the next screen.
        Do not use a real patient record here.
      </p>

      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
