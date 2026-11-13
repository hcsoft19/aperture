"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/features/auth/actions";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/features/auth/schemas";

export function ForgotPasswordForm() {
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<"error" | "success" | null>(
    null,
  );

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerMessage(null);
    setServerStatus(null);
    const result = await requestPasswordResetAction(values);
    setServerStatus(result.status);
    setServerMessage(result.message);
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
        <Label htmlFor="recovery-email">Email</Label>
        <Input
          id="recovery-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "recovery-email-error" : undefined}
          {...form.register("email")}
        />
        {emailError ? (
          <p id="recovery-email-error" className="text-sm text-destructive" role="alert">
            {emailError}
          </p>
        ) : null}
      </div>

      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
