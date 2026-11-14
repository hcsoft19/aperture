"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CatalogCombobox,
  type CatalogOption,
  type CatalogOptionType,
} from "@/features/catalog";
import {
  createTreatmentAction,
  updateTreatmentAction,
} from "@/features/patients/actions";
import { treatmentStatusOptions } from "@/features/patients/labels";
import {
  treatmentSchema,
  type TreatmentValues,
} from "@/features/patients/schemas";
import { parseFollowUpDaysInput } from "@/features/treatment-templates/model";

type CatalogOptions = Record<CatalogOptionType, CatalogOption[]>;

type TreatmentFormProps = {
  patientId: string;
  treatmentId?: string;
  defaultValues: TreatmentValues;
  catalogOptions: CatalogOptions;
  submitLabel: string;
  pendingLabel: string;
  plannedFollowUp?: { days: number | null };
};

export function TreatmentForm({
  patientId,
  treatmentId,
  defaultValues,
  catalogOptions,
  submitLabel,
  pendingLabel,
  plannedFollowUp,
}: TreatmentFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [followUpInput, setFollowUpInput] = useState(
    plannedFollowUp?.days == null ? "" : String(plannedFollowUp.days),
  );
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const form = useForm<TreatmentValues>({
    resolver: zodResolver(treatmentSchema),
    defaultValues,
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    setMessage(null);
    setFollowUpError(null);

    if (treatmentId) {
      const result = await updateTreatmentAction(patientId, treatmentId, values);
      if (result?.status === "error") {
        setMessage(result.message);
      }
      return;
    }

    let followUpDays: number | null = null;
    if (plannedFollowUp) {
      const parsedFollowUp = parseFollowUpDaysInput(followUpInput);
      if (!parsedFollowUp.ok) {
        setFollowUpError(parsedFollowUp.message);
        return;
      }
      followUpDays = parsedFollowUp.days;
    }

    const result = plannedFollowUp
      ? await createTreatmentAction(patientId, values, followUpDays)
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
      <CatalogCombobox
        type="treatment_name"
        label="Treatment"
        options={catalogOptions.treatment_name}
        value={form.watch("name")}
        onChange={(value) => form.setValue("name", value, { shouldValidate: true })}
        error={errors.name?.message}
        required
        placeholder="Select or type treatment name..."
      />
      <CatalogCombobox
        type="category"
        label="Category"
        options={catalogOptions.category}
        value={form.watch("category")}
        onChange={(value) => form.setValue("category", value, { shouldValidate: true })}
        error={errors.category?.message}
        required
        placeholder="Select or type category..."
      />
      <CatalogCombobox
        type="procedure_type"
        label="Procedure / type"
        options={catalogOptions.procedure_type}
        value={form.watch("procedureType") ?? ""}
        onChange={(value) => form.setValue("procedureType", value, { shouldValidate: true })}
        error={errors.procedureType?.message}
        placeholder="Select or type procedure..."
      />
      <CatalogCombobox
        type="product"
        label="Product / drug (optional)"
        options={catalogOptions.product}
        value={form.watch("productName") ?? ""}
        onChange={(value) => form.setValue("productName", value, { shouldValidate: true })}
        error={errors.productName?.message}
        placeholder="Select or type product..."
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
      <CatalogCombobox
        type="body_area"
        label="Body area"
        options={catalogOptions.body_area}
        value={form.watch("bodyArea")}
        onChange={(value) => form.setValue("bodyArea", value, { shouldValidate: true })}
        error={errors.bodyArea?.message}
        required
        placeholder="Select or type body area..."
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
      {plannedFollowUp ? (
        <div className="flex flex-col gap-2">
          <Label className="text-base" htmlFor="treatment-follow-up">
            Follow-up days
          </Label>
          <Input
            id="treatment-follow-up"
            inputMode="numeric"
            value={followUpInput}
            aria-invalid={followUpError ? true : undefined}
            aria-describedby={
              followUpError
                ? "treatment-follow-up-hint treatment-follow-up-error"
                : "treatment-follow-up-hint"
            }
            onChange={(event) => setFollowUpInput(event.target.value)}
          />
          <p id="treatment-follow-up-hint" className="text-base leading-7 text-muted-foreground">
            Optional. From the template. Enter 1 to 3650 days, or leave blank.
          </p>
          {followUpError ? (
            <p id="treatment-follow-up-error" className="text-base text-destructive" role="alert">
              {followUpError}
            </p>
          ) : null}
        </div>
      ) : null}
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
