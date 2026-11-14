"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTreatmentTemplateAction } from "@/features/treatment-templates/actions";
import {
  protocolOptions,
  treatmentTemplateSchema,
  type TreatmentTemplateInput,
  type TreatmentTemplateValues,
} from "@/features/treatment-templates/model";

const emptyTemplate: TreatmentTemplateInput = {
  name: "",
  category: "",
  bodyArea: "",
  protocolCode: "FACE_STANDARD",
  followUpDays: "",
};

export function TreatmentTemplateForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const form = useForm<TreatmentTemplateInput, unknown, TreatmentTemplateValues>({
    resolver: zodResolver(treatmentTemplateSchema),
    defaultValues: emptyTemplate,
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    setMessage(null);
    setSaved(false);
    const result = await createTreatmentTemplateAction(values);
    if (result.status === "error") {
      setMessage(result.message);
      return;
    }
    form.reset(emptyTemplate);
    setSaved(true);
  });

  return (
    <section aria-labelledby="new-template-heading" className="max-w-md">
      <h2 id="new-template-heading" className="text-2xl font-semibold tracking-tight">
        New template
      </h2>
      <p className="mt-2 text-base leading-7 text-muted-foreground">
        Save a reusable treatment for this clinic. Applying it later starts a new
        draft and leaves existing treatments unchanged.
      </p>
      <form className="mt-5 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {message ? (
          <p className="text-base text-destructive" role="alert">
            {message}
          </p>
        ) : null}
        {saved ? (
          <p className="text-base text-foreground" role="status">
            Template saved.
          </p>
        ) : null}
        <TextField
          id="template-name"
          label="Template name"
          error={errors.name?.message}
          registration={form.register("name")}
        />
        <TextField
          id="template-category"
          label="Category"
          error={errors.category?.message}
          registration={form.register("category")}
        />
        <TextField
          id="template-body-area"
          label="Body area"
          error={errors.bodyArea?.message}
          registration={form.register("bodyArea")}
        />
        <div className="flex flex-col gap-2">
          <Label className="text-base" htmlFor="template-protocol">
            Photography protocol
          </Label>
          <select
            id="template-protocol"
            className="min-h-11 w-full cursor-pointer rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-invalid={errors.protocolCode ? true : undefined}
            aria-describedby={errors.protocolCode ? "template-protocol-error" : undefined}
            {...form.register("protocolCode")}
          >
            {protocolOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.protocolCode?.message ? (
            <p id="template-protocol-error" className="text-base text-destructive" role="alert">
              {errors.protocolCode.message}
            </p>
          ) : null}
        </div>
        <TextField
          id="template-follow-up"
          label="Follow-up days"
          hint="Optional. Enter 1 to 3650 days, or leave blank."
          error={errors.followUpDays?.message}
          registration={form.register("followUpDays")}
          inputMode="numeric"
        />
        <Button
          type="submit"
          size="lg"
          className="cursor-pointer"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Saving template…" : "Save template"}
        </Button>
      </form>
    </section>
  );
}

function TextField({
  id,
  label,
  error,
  hint,
  registration,
  inputMode,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  registration: ReturnType<
    ReturnType<typeof useForm<TreatmentTemplateInput>>["register"]
  >;
  inputMode?: "numeric" | "text";
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-base" htmlFor={id}>
        {label}
      </Label>
      <Input
        id={id}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...registration}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-base leading-7 text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-base text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
