"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { updatePasswordAction } from "@/features/auth/actions";
import { PasswordField } from "@/features/auth/password-field";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/features/auth/schemas";

export function ResetPasswordForm() {
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerMessage(null);
    const result = await updatePasswordAction(values);
    if (result?.status === "error") {
      setServerMessage(result.message);
    }
  });

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
      {serverMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {serverMessage}
        </p>
      ) : null}
      <PasswordField
        id="new-password"
        label="New password"
        autoComplete="new-password"
        error={form.formState.errors.password?.message}
        registration={form.register("password")}
      />
      <PasswordField
        id="confirm-new-password"
        label="Confirm new password"
        autoComplete="new-password"
        error={form.formState.errors.confirmPassword?.message}
        registration={form.register("confirmPassword")}
      />
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}
