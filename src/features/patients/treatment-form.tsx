"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createTreatmentAction,
  updateTreatmentAction,
} from "@/features/patients/actions";
import { treatmentStatusOptions } from "@/features/patients/labels";
import {
  treatmentSchema,
  type TreatmentValues,
} from "@/features/patients/schemas";

type TreatmentFormProps = {
  patientId: string;
  treatmentId?: string;
  defaultValues: TreatmentValues;
  submitLabel: string;
  pendingLabel: string;
};

export function TreatmentForm({
  patientId,
  treatmentId,
  defaultValues,
  submitLabel,
  pendingLabel,
}: TreatmentFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<TreatmentValues>({
    resolver: zodResolver(treatmentSchema),
    defaultValues,
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    setMessage(null);
    const result = treatmentId
      ? await updateTreatmentAction(patientId, treatmentId, values)
      : await createTreatmentAction(patientId, values);
    if (result?.status === "error") {
      setMessage(result.message);
    }
  });

  return (
    <form
      className="flex max-w-md flex-col gap-4"
      onSubmit={onSubmit}
      noValidate
    >
      {message ? (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <TextField
        id="treatment-name"
        label="Treatment"
        error={errors.name?.message}
        registration={form.register("name")}
      />
      <TextField
        id="treatment-category"
        label="Category"
        error={errors.category?.message}
        registration={form.register("category")}
      />
      <TextField
        id="treatment-procedure"
        label="Procedure / type"
        error={errors.procedureType?.message}
        registration={form.register("procedureType")}
      />
      <TextField
        id="treatment-product"
        label="Product / drug (optional)"
        error={errors.productName?.message}
        registration={form.register("productName")}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="treatment-protocol">Photography protocol</Label>
        <select
          id="treatment-protocol"
          className="min-h-11 rounded-lg border border-input bg-card px-3 text-base"
          {...form.register("protocolCode")}
        >
          <option value="FACE_STANDARD">Standard facial views</option>
          <option value="DENTAL_STANDARD">Dental documentation</option>
          <option value="BODY_STANDARD">Body documentation</option>
        </select>
        <p className="text-sm text-muted-foreground">
          New sessions use this protocol. Existing session records remain
          unchanged.
        </p>
      </div>
      <TextField
        id="treatment-body-area"
        label="Body area"
        error={errors.bodyArea?.message}
        registration={form.register("bodyArea")}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="treatment-status">Status</Label>
        <select
          id="treatment-status"
          className="h-11 rounded-lg border border-input bg-transparent px-3 text-base"
          aria-invalid={errors.status ? true : undefined}
          {...form.register("status")}
        >
          {treatmentStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <TextField
        id="treatment-start"
        label="Start date"
        type="date"
        error={errors.startDate?.message}
        registration={form.register("startDate")}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="treatment-description">Notes</Label>
        <Textarea
          id="treatment-description"
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={
            errors.description ? "treatment-description-error" : undefined
          }
          {...form.register("description")}
        />
        {errors.description ? (
          <p
            id="treatment-description-error"
            className="text-sm text-destructive"
            role="alert"
          >
            {errors.description.message}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}

function TextField({
  id,
  label,
  error,
  registration,
  type = "text",
}: {
  id: string;
  label: string;
  error?: string;
  registration: ReturnType<
    ReturnType<typeof useForm<TreatmentValues>>["register"]
  >;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
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
