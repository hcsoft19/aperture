"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileNameAction } from "@/features/organizations/actions";
import { profileNameSchema, type ProfileNameValues } from "@/features/organizations/schemas";

type ProfileNameFormProps = {
  fullName: string | null;
};

export function ProfileNameForm({ fullName }: ProfileNameFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<"error" | "success" | null>(null);
  const form = useForm<ProfileNameValues>({
    resolver: zodResolver(profileNameSchema),
    defaultValues: { fullName: fullName ?? "" },
  });
  const nameError = form.formState.errors.fullName?.message;

  const onSubmit = form.handleSubmit(async (values) => {
    setMessage(null);
    setStatus(null);
    const result = await updateProfileNameAction(values);
    setStatus(result.status);
    setMessage(result.message);
  });

  return (
    <form className="flex max-w-md flex-col gap-4" onSubmit={onSubmit} noValidate>
      {message ? (
        <p
          className={status === "success" ? "text-sm text-foreground" : "text-sm text-destructive"}
          role={status === "success" ? "status" : "alert"}
        >
          {message}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="full-name">Name</Label>
        <Input
          id="full-name"
          autoComplete="name"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "full-name-error" : undefined}
          {...form.register("fullName")}
        />
        {nameError ? (
          <p id="full-name-error" className="text-sm text-destructive" role="alert">
            {nameError}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving…" : "Save name"}
      </Button>
    </form>
  );
}
