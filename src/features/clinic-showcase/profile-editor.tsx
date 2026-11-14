"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, Copy, ExternalLink, ImagePlus } from "lucide-react";
import { saveClinicProfile, setClinicPublished } from "./actions";
import {
  clinicProfileSchema,
  profileValues,
  profileCompleteness,
  type ClinicProfile,
  type ClinicProfileValues,
  socialPlatforms,
} from "./models";
export function ProfileEditor({
  profile,
  clinicName,
  canEdit,
  origin,
}: {
  profile: ClinicProfile | null;
  clinicName: string;
  canEdit: boolean;
  origin: string;
}) {
  const form = useForm<ClinicProfileValues>({
    resolver: zodResolver(clinicProfileSchema),
    defaultValues: profileValues(profile, clinicName),
  });
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const booking = useWatch({ control: form.control, name: "booking_mode" });
  const completeness = profileCompleteness(profile);
  const submit = form.handleSubmit(async (values) => {
    setMessage("");
    const r = await saveClinicProfile(values);
    setMessage(r.message);
  });
  const url = profile ? `${origin}/clinics/${profile.slug}` : "";
  return (
    <div className="space-y-8">
      <div className="grid gap-5 rounded-2xl border border-border bg-secondary/50 p-5 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="eyebrow text-primary">Your public address</p>
          {url ? (
            <p className="mt-3 break-all text-base font-medium">{url}</p>
          ) : (
            <p className="mt-3 text-base text-muted-foreground">
              Choose your address and save the profile to get your shareable
              link.
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            {profile?.published
              ? "Live · Saved profile changes appear publicly."
              : "Draft · Your page is private until you publish it."}
          </p>
          <div
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-border"
            aria-hidden="true"
          >
            <div
              className="h-full bg-primary"
              style={{ width: `${completeness}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Profile {completeness}% complete
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {url ? (
            <Button
              variant="outline"
              size="lg"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {
                  setMessage("Copy the public address shown above.");
                }
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          ) : null}
          {profile ? (
            <a
              href="/api/clinic/qr"
              download="clinic-qr.png"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Download QR code
            </a>
          ) : null}
          {profile ? (
            <Link
              href="/clinic/preview"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <ExternalLink />
              Preview saved page
            </Link>
          ) : null}
          {profile?.published ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              View live page
            </a>
          ) : null}
        </div>
      </div>
      {message ? (
        <p
          role="status"
          className="rounded-xl border border-border bg-muted p-4 text-base"
        >
          {message}
        </p>
      ) : null}
      <form onSubmit={submit} noValidate className="space-y-8">
        <fieldset
          disabled={!canEdit || form.formState.isSubmitting}
          className="space-y-8 disabled:opacity-70"
        >
          <section className="rounded-2xl border border-border p-5 sm:p-7">
            <h2 className="text-xl font-medium">
              A first impression, thoughtfully made.
            </h2>
            <p className="mt-2 text-base leading-7 text-muted-foreground">
              Everything entered here is intended for your public clinic page.
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field
                name="display_name"
                label="Public clinic name"
                form={form}
              />
              <Field
                name="slug"
                label="Public URL slug"
                form={form}
                placeholder="aurora-aesthetics-miami"
              />
              <div className="sm:col-span-2">
                <Label htmlFor="introduction">Clinic introduction</Label>
                <Textarea
                  id="introduction"
                  {...form.register("introduction")}
                  className="mt-2 min-h-32"
                />
                <ErrorText
                  message={form.formState.errors.introduction?.message}
                />
              </div>
              <Field
                name="specialties"
                label="Specialties / services"
                form={form}
                placeholder="Skin care, facial aesthetics, dental care"
              />
              <Field
                name="languages"
                label="Languages spoken"
                form={form}
                placeholder="English, Portuguese"
              />
            </div>
          </section>
          <section className="rounded-2xl border border-border p-5 sm:p-7">
            <h2 className="text-xl font-medium">Help people find you.</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field name="address" label="Street address" form={form} />
              <Field name="city" label="City" form={form} />
              <Field name="region" label="State / region" form={form} />
              <Field name="postal_code" label="Postal code" form={form} />
              <Field name="country" label="Country" form={form} />
              <Field
                name="opening_hours"
                label="Opening hours"
                form={form}
                placeholder="Monday–Friday, 9am–6pm"
              />
            </div>
          </section>
          <section className="rounded-2xl border border-border p-5 sm:p-7">
            <h2 className="text-xl font-medium">Make it easy to connect.</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field
                name="phone"
                label="Public telephone"
                form={form}
                type="tel"
              />
              <Field
                name="whatsapp"
                label="WhatsApp number with country code"
                form={form}
                type="tel"
                placeholder="+1 305 555 0100"
              />
              <Field
                name="email"
                label="Public email"
                form={form}
                type="email"
              />
              <Field
                name="contact_name"
                label="Public contact name / role"
                form={form}
              />
              <Field
                name="website"
                label="Clinic website"
                form={form}
                type="url"
                placeholder="https://"
              />
              {socialPlatforms.map((name) => (
                <Field
                  key={name}
                  name={name}
                  label={name.charAt(0).toUpperCase() + name.slice(1) + " URL"}
                  form={form}
                  type="url"
                  placeholder="https://"
                />
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-secondary/30 p-5 sm:p-7">
            <h2 className="text-xl font-medium">
              An invitation to take the next step.
            </h2>
            <p className="mt-2 text-base leading-7 text-muted-foreground">
              Booking is optional. The button opens your WhatsApp or your
              existing booking service.
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="booking-mode">Booking button</Label>
                <select
                  id="booking-mode"
                  {...form.register("booking_mode")}
                  className="mt-2 min-h-11 w-full rounded-lg border border-input bg-card px-3 text-base"
                >
                  <option value="none">Hidden — no booking button</option>
                  <option value="whatsapp">Open clinic WhatsApp</option>
                  <option value="external">Open external booking system</option>
                </select>
              </div>
              {booking !== "none" ? (
                <Field name="booking_label" label="Button label" form={form} />
              ) : null}
              {booking === "external" ? (
                <Field
                  name="booking_destination"
                  label="Booking system URL"
                  form={form}
                  type="url"
                  placeholder="https://"
                />
              ) : null}
              {booking === "whatsapp" ? (
                <p className="self-end text-base leading-7 text-muted-foreground">
                  Uses the WhatsApp number entered above. No booking is created
                  in Aperture.
                </p>
              ) : null}
            </div>
            <label className="mt-5 flex min-h-11 items-center gap-3 text-base">
              <input
                type="checkbox"
                {...form.register("allow_indexing")}
                className="size-5 accent-primary"
              />
              Allow search engines to index the published clinic page
            </label>
          </section>
        </fieldset>
        {canEdit ? (
          <Button
            size="lg"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? "Saving…" : "Save clinic profile"}
          </Button>
        ) : (
          <p className="text-base text-muted-foreground">
            A clinic administrator can edit and publish this page.
          </p>
        )}
      </form>
      {profile ? (
        <section className="grid gap-6 rounded-2xl border border-border p-5 sm:grid-cols-2 sm:p-7">
          <BrandUpload kind="logo" profile={profile} disabled={!canEdit} />
          <BrandUpload kind="cover" profile={profile} disabled={!canEdit} />
        </section>
      ) : null}
      {profile && canEdit ? (
        <section className="flex flex-col gap-4 rounded-2xl border border-border bg-secondary/50 p-5 sm:p-7">
          <h2 className="text-xl font-medium">Publish with intention.</h2>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            Publishing makes your saved contact details and selected gallery
            results accessible to everyone, including search engines. Private
            charts and the rest of your workspace stay private.
          </p>
          <Button
            size="lg"
            variant={profile.published ? "outline" : "default"}
            className="self-start"
            disabled={pending || form.formState.isSubmitting}
            onClick={async () => {
              setPending(true);
              try {
                const result = await setClinicPublished(!profile.published);
                setMessage(result.message);
              } finally {
                setPending(false);
              }
            }}
          >
            {pending
              ? "Updating…"
              : profile.published
                ? "Take clinic page offline"
                : "Publish clinic page"}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
function Field({
  name,
  label,
  form,
  type = "text",
  placeholder,
}: {
  name: keyof ClinicProfileValues;
  label: string;
  form: ReturnType<typeof useForm<ClinicProfileValues>>;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        type={type}
        placeholder={placeholder}
        className="mt-2"
        aria-invalid={!!form.formState.errors[name]}
        {...form.register(name)}
      />
      <ErrorText message={form.formState.errors[name]?.message} />
    </div>
  );
}
function ErrorText({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="mt-2 text-sm text-destructive">
      {message}
    </p>
  ) : null;
}
function BrandUpload({
  kind,
  profile,
  disabled,
}: {
  kind: "logo" | "cover";
  profile: ClinicProfile;
  disabled: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);
  const [hasImage, setHasImage] = useState(
    Boolean(kind === "logo" ? profile.logo_path : profile.cover_path),
  );
  return (
    <div>
      <h2 className="text-xl font-medium">
        {kind === "logo" ? "Clinic logo" : "Cover image"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        JPG, PNG or WebP · up to 2 MB · image metadata removed
      </p>
      {hasImage ? (
        <Image
          src={`/api/clinic/branding/${profile.organization_id}/${kind}?v=${version}`}
          alt={`Clinic ${kind}`}
          width={kind === "logo" ? 160 : 480}
          height={160}
          unoptimized
          className="mt-4 h-40 w-auto max-w-full rounded-xl bg-muted object-contain"
        />
      ) : (
        <div className="mt-4 flex h-40 items-center justify-center rounded-xl bg-muted text-primary">
          <ImagePlus aria-hidden="true" />
        </div>
      )}
      <form
        className="mt-4 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          data.set("kind", kind);
          setPending(true);
          setMessage("");
          try {
            const response = await fetch("/api/clinic/branding", {
              method: "POST",
              body: data,
            });
            const json = await response.json();
            setMessage(json.message);
            if (response.ok) {
              setHasImage(true);
              setVersion(json.version);
            }
          } catch {
            setMessage("Image upload unavailable. Try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        <Label htmlFor={`upload-${kind}`}>Choose {kind}</Label>
        <Input
          id={`upload-${kind}`}
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          disabled={disabled || pending}
        />
        <Button
          type="submit"
          variant="outline"
          size="lg"
          disabled={disabled || pending}
        >
          {pending ? "Uploading…" : `Save ${kind}`}
        </Button>
        {message ? (
          <p role="status" className="text-base">
            {message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
