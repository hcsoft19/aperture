"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { archiveTreatmentTemplateAction } from "@/features/treatment-templates/actions";
import {
  choosePatientForTemplateHref,
  protocolLabel,
  type TreatmentTemplate,
} from "@/features/treatment-templates/model";

export function TreatmentTemplateList({
  templates,
  canArchive,
}: {
  templates: TreatmentTemplate[];
  canArchive: boolean;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onArchive(template: TreatmentTemplate) {
    setPendingId(template.id);
    setMessage(null);
    const result = await archiveTreatmentTemplateAction(template.id);
    setPendingId(null);
    if (result.status === "error") {
      setMessage(result.message);
    }
  }

  return (
    <section aria-labelledby="saved-templates-heading">
      <h2 id="saved-templates-heading" className="text-2xl font-semibold tracking-tight">
        Saved templates
      </h2>
      {message ? (
        <p className="mt-3 text-base text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      {templates.length === 0 ? (
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          No treatment templates yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {templates.map((template) => (
            <li key={template.id} className="rounded-xl border border-border p-5">
              <h3 className="text-xl font-semibold tracking-tight">{template.name}</h3>
              <dl className="mt-3 space-y-2 text-base leading-7">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium">Category</dt>
                  <dd>{template.category}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium">Body area</dt>
                  <dd>{template.bodyArea}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium">Photography protocol</dt>
                  <dd>{protocolLabel(template.protocolCode)}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium">Follow-up</dt>
                  <dd>{followUpLabel(template.followUpDays)}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={choosePatientForTemplateHref(template.id)}
                  className={buttonVariants({ size: "lg" })}
                  aria-label={`Start a treatment from ${template.name}`}
                >
                  Start treatment
                </Link>
                {canArchive ? (
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="cursor-pointer"
                    disabled={pendingId !== null}
                    aria-label={`Archive ${template.name}`}
                    onClick={() => onArchive(template)}
                  >
                    {pendingId === template.id ? "Archiving…" : "Archive"}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function followUpLabel(days: number | null) {
  if (days === null) {
    return "No planned follow-up";
  }
  if (days === 1) {
    return "1 day";
  }
  return `${days} days`;
}
