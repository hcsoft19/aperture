"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPatientAction, updatePatientAction } from "@/features/patients/actions";
import { patientSchema, type PatientValues } from "@/features/patients/schemas";

type PatientFormProps = {
  patientId?: string;
  defaultValues: PatientValues;
  submitLabel: string;
  pendingLabel: string;
};

export function PatientForm({
  patientId,
  defaultValues,
  submitLabel,
  pendingLabel,
}: PatientFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<PatientValues>({
    resolver: zodResolver(patientSchema),
    defaultValues,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setMessage(null);
    const result = patientId
      ? await updatePatientAction(patientId, values)
      : await createPatientAction(values);
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
      <Field
        id="first-name"
        label="First name"
        error={form.formState.errors.firstName?.message}
        autoComplete="given-name"
        registration={form.register("firstName")}
      />
      <Field
        id="last-name"
        label="Last name"
        error={form.formState.errors.lastName?.message}
        autoComplete="family-name"
        registration={form.register("lastName")}
      />
      <Field
        id="date-of-birth"
        label="Date of birth"
        type="date"
        error={form.formState.errors.dateOfBirth?.message}
        registration={form.register("dateOfBirth")}
      />
      <Field
        id="contact-email"
        label="Contact email"
        type="email"
        autoComplete="email"
        error={form.formState.errors.contactEmail?.message}
        registration={form.register("contactEmail")}
      />
      <Field
        id="phone"
        label="Phone"
        type="tel"
        autoComplete="tel"
        error={form.formState.errors.phone?.message}
        registration={form.register("phone")}
      />
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  registration,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm<PatientValues>>["register"]>;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...registration}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
