"use client";
import Image from "next/image";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { preparePublication, setResultPublished } from "./actions";
import {
  publicationSchema,
  type PublicationValues,
  type PublicResult,
} from "./models";
type Source = {
  id: string;
  title: string;
  category: string;
  procedure: string;
  bodyArea: string;
};
export function PublicationManager({
  results,
  sources,
  canEdit,
}: {
  results: (PublicResult & { revoked?: boolean })[];
  sources: Source[];
  canEdit: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useForm<PublicationValues>({
    resolver: zodResolver(publicationSchema),
    defaultValues: {
      comparisonId: "",
      title: "",
      category: "",
      procedure: "",
      bodyArea: "",
      summary: "",
      interval: "",
      consentReference: "",
      confirmPermission: false,
    },
  });
  const submit = form.handleSubmit(async (values) => {
    setMessage("");
    try {
      const r = await preparePublication(values);
      setMessage(r.message);
      if (r.ok) form.reset();
    } catch {
      setMessage("The public result could not be prepared. Please try again.");
    }
  });
  return (
    <div className="space-y-7">
      <div className="max-w-3xl">
        <h2 className="editorial-title text-3xl">
          Choose the stories you share.
        </h2>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Only comparisons explicitly prepared and published here appear on your
          public page. Sharing with a patient does not publish a result.
        </p>
      </div>
      {message ? (
        <p role="status" className="rounded-xl bg-secondary p-4 text-base">
          {message}
        </p>
      ) : null}
      {canEdit ? (
        <details className="rounded-2xl border border-border bg-card p-5">
          <summary className="min-h-11 cursor-pointer py-2 text-lg font-medium text-primary">
            Prepare a public result
          </summary>
          <form className="mt-5 space-y-5" onSubmit={submit} noValidate>
            <fieldset
              disabled={form.formState.isSubmitting}
              className="grid gap-5 sm:grid-cols-2"
            >
              <div className="sm:col-span-2">
                <Label htmlFor="public-source">Private clinic comparison</Label>
                <select
                  id="public-source"
                  {...form.register("comparisonId")}
                  onChange={(event) => {
                    form.setValue("comparisonId", event.target.value);
                    const source = sources.find(
                      (x) => x.id === event.target.value,
                    );
                    if (source) {
                      form.setValue("category", source.category);
                      form.setValue("procedure", source.procedure);
                      form.setValue("bodyArea", source.bodyArea);
                    }
                  }}
                  className="mt-2 min-h-11 w-full rounded-lg border border-input bg-card px-3 text-base"
                >
                  <option value="">Select a completed comparison</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-muted-foreground">
                  Licensed reference demos are excluded. Do not include patient
                  names or identifying details in public text.
                </p>
              </div>
              {(
                [
                  ["title", "Public result title"],
                  ["category", "Public category"],
                  ["procedure", "Procedure / type"],
                  ["bodyArea", "Body area"],
                  ["interval", "Treatment interval (optional)"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <Label htmlFor={`public-${key}`}>{label}</Label>
                  <Input
                    id={`public-${key}`}
                    {...form.register(key)}
                    className="mt-2"
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <Label htmlFor="public-summary">Public description</Label>
                <Textarea
                  id="public-summary"
                  {...form.register("summary")}
                  className="mt-2 min-h-28"
                  placeholder="Describe the procedure and context without identifying the patient or promising an outcome."
                />
              </div>
              <div className="sm:col-span-2 rounded-xl bg-secondary/60 p-4">
                <Label htmlFor="permission-reference">
                  Public marketing permission reference (private)
                </Label>
                <Input
                  id="permission-reference"
                  {...form.register("consentReference")}
                  className="mt-2"
                  placeholder="Your signed permission record reference"
                />
                <label className="mt-3 flex min-h-11 items-start gap-3 text-base leading-7">
                  <input
                    type="checkbox"
                    {...form.register("confirmPermission")}
                    className="mt-1.5 size-5 shrink-0 accent-primary"
                  />
                  I confirm the clinic has permission to publish these
                  photographs and this description publicly for marketing.
                  Clinical photography consent and patient sharing alone are not
                  sufficient.
                </label>
              </div>
            </fieldset>
            {Object.values(form.formState.errors).length ? (
              <ul role="alert" className="space-y-1 text-sm text-destructive">
                {Object.entries(form.formState.errors).map(([key, error]) => (
                  <li key={key}>{error.message}</li>
                ))}
              </ul>
            ) : null}
            <Button
              type="submit"
              size="lg"
              disabled={form.formState.isSubmitting || !sources.length}
            >
              {form.formState.isSubmitting
                ? "Preparing web copies…"
                : "Prepare private draft"}
            </Button>
          </form>
        </details>
      ) : (
        <p className="rounded-xl bg-muted p-4 text-base">
          A clinic administrator manages public publication and permission.
        </p>
      )}
      {!results.length ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-base leading-7 text-muted-foreground">
          No public results yet. You can publish your clinic contact page with
          an empty gallery.
        </div>
      ) : (
        <ul className="grid gap-6 xl:grid-cols-2">
          {results.map((result) => (
            <li
              key={result.id}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              {result.revoked ? (
                <div className="rounded-xl bg-muted p-6 text-base text-muted-foreground">
                  Public permission withdrawn. The web image copies have been
                  removed.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-px bg-border">
                  {["before", "after"].map((side) => (
                    <div key={side} className="relative aspect-[3/4] bg-muted">
                      <Image
                        src={`/api/clinic/showcase/${result.id}?side=${side}`}
                        alt={`${side} — ${result.title}`}
                        fill
                        unoptimized
                        className="object-contain"
                        sizes="300px"
                      />
                      <span className="absolute bottom-3 left-3 rounded-md bg-card/95 px-2 py-1 text-sm capitalize">
                        {side}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-4 p-5">
                <p className="eyebrow text-primary">
                  {result.revoked
                    ? "Permission withdrawn"
                    : result.published
                      ? "Published selection"
                      : "Private draft"}
                </p>
                <h3 className="text-xl font-medium">{result.title}</h3>
                <p className="text-base leading-7 text-muted-foreground">
                  {result.summary}
                </p>
                <p className="text-sm text-muted-foreground">
                  {result.category}
                  {result.treatment_interval
                    ? ` · ${result.treatment_interval}`
                    : ""}
                </p>
                {canEdit && !result.revoked ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="lg"
                      variant={result.published ? "outline" : "default"}
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const r = await setResultPublished({
                            id: result.id,
                            published: !result.published,
                          });
                          setMessage(r.message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {result.published ? "Unpublish result" : "Publish result"}
                    </Button>
                    <details className="w-full border-t border-border pt-3">
                      <summary className="min-h-11 cursor-pointer py-3 text-sm text-primary">
                        Withdraw marketing permission
                      </summary>
                      <p className="mb-3 text-sm leading-6 text-muted-foreground">
                        This removes public access to the result and its web
                        images. Publishing again requires a new permission
                        record. Copies already saved by visitors may remain.
                      </p>
                      <Button
                        size="lg"
                        variant="outline"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const r = await setResultPublished({
                              id: result.id,
                              published: false,
                              revoke: true,
                            });
                            setMessage(r.message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Withdraw permission & remove result
                      </Button>
                    </details>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
