"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrganizationAction } from "@/features/organizations/actions";
import {
  organizationNameSchema,
  type OrganizationNameValues,
} from "@/features/organizations/schemas";

export function CreateClinicForm() {
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<OrganizationNameValues>({
    resolver: zodResolver(organizationNameSchema),
    defaultValues: { name: "" },
  });
  const nameError = form.formState.errors.name?.message;

  const onSubmit = form.handleSubmit(async (values) => {
    setMessage(null);
    const result = await createOrganizationAction(values);
    if (result?.status === "error") {
      setMessage(result.message);
    }
  });

  return (
    <form className="flex max-w-md flex-col gap-4" onSubmit={onSubmit} noValidate>
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="clinic-name">Clinic name</Label>
        <Input
          id="clinic-name"
          autoComplete="organization"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "clinic-name-error" : undefined}
          {...form.register("name")}
        />
        {nameError ? (
          <p id="clinic-name-error" className="text-sm text-destructive" role="alert">
            {nameError}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Creating clinic…" : "Create clinic"}
      </Button>
    </form>
  );
}
