import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  MapPin,
  Phone,
  Mail,
  Clock,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  safeExternalUrl,
  whatsappUrl,
  type ClinicProfile,
  type PublicResult,
  socialPlatforms,
} from "./models";
export function publicImageUrl(
  clinic: ClinicProfile,
  result: PublicResult,
  side: string,
) {
  return `/clinics/${clinic.slug}/results/${result.slug}/media/${side}`;
}
function ResultImage({
  clinic,
  result,
  side,
  preview = false,
}: {
  clinic: ClinicProfile;
  result: PublicResult;
  side: string;
  preview?: boolean;
}) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden bg-muted">
      <Image
        src={
          preview
            ? `/api/clinic/showcase/${result.id}?side=${side}`
            : publicImageUrl(clinic, result, side)
        }
        alt={`${side === "before" ? "Before" : "After"} ${result.procedure_type || result.title}${result.body_area ? ` — ${result.body_area}` : ""}`}
        fill
        unoptimized
        className="object-contain"
        sizes="(min-width: 1024px) 500px, 45vw"
      />
      <span className="absolute bottom-3 left-3 rounded-md bg-card/95 px-3 py-1.5 text-sm font-medium capitalize">
        {side}
      </span>
    </div>
  );
}
export function ClinicHeader({ profile }: { profile: ClinicProfile }) {
  return (
    <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-10">
      <Link
        href={`/clinics/${profile.slug}`}
        className="flex min-h-11 items-center gap-3 text-lg font-medium tracking-tight"
      >
        {profile.logo_path ? (
          <Image
            src={`/api/clinic/branding/${profile.organization_id}/logo`}
            alt={`${profile.display_name} logo`}
            width={56}
            height={56}
            unoptimized
            className="size-14 object-contain"
          />
        ) : null}
        {profile.display_name}
      </Link>
      <nav
        className="flex flex-wrap items-center gap-4 text-base"
        aria-label="Clinic navigation"
      >
        <a
          href={`/clinics/${profile.slug}#results`}
          className="inline-flex min-h-11 items-center"
        >
          Our results
        </a>
        <a
          href={`/clinics/${profile.slug}#contact`}
          className="inline-flex min-h-11 items-center"
        >
          Contact
        </a>
        <Booking profile={profile} />
      </nav>
    </header>
  );
}
export function Booking({ profile }: { profile: ClinicProfile }) {
  const url = safeExternalUrl(profile.booking_url);
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({
        size: "lg",
        className:
          "h-auto min-h-11 max-w-full whitespace-normal py-2 text-center",
      })}
    >
      {profile.booking_label}
      <ArrowUpRight aria-hidden="true" />
    </a>
  ) : null;
}
export function ClinicPublicView({
  profile,
  results,
  total = results.length,
  page = 1,
  size = 12,
  categories = [],
  category = "",
  preview = false,
}: {
  profile: ClinicProfile;
  results: PublicResult[];
  total?: number;
  page?: number;
  size?: number;
  categories?: string[];
  category?: string;
  preview?: boolean;
}) {
  const base = `/clinics/${profile.slug}`;
  const pages = Math.ceil(total / size);
  const pageHref = (p: number) =>
    `${base}?${new URLSearchParams({ ...(category ? { category } : {}), page: String(p) })}#results`;
  return (
    <div className="bg-background pb-24 text-foreground sm:pb-0">
      {preview ? (
        <div className="border-b border-border bg-secondary px-5 py-3 text-center text-sm text-primary">
          Private preview of saved content ·{" "}
          <Link
            href="/clinic"
            className="inline-flex min-h-11 items-center font-medium underline"
          >
            Back to clinic settings
          </Link>
        </div>
      ) : null}
      <ClinicHeader profile={profile} />
      <section className="relative mx-5 overflow-hidden rounded-3xl bg-secondary/70 sm:mx-10">
        {profile.cover_path ? (
          <Image
            src={`/api/clinic/branding/${profile.organization_id}/cover`}
            alt={`${profile.display_name} clinic`}
            fill
            unoptimized
            className="object-cover"
            sizes="100vw"
            priority
          />
        ) : null}
        <div
          className={`relative mx-auto grid max-w-7xl gap-8 px-6 py-16 sm:px-12 sm:py-24 ${profile.cover_path ? "bg-background/90 md:bg-transparent md:bg-linear-to-r md:from-background/95 md:to-background/40" : ""}`}
        >
          <div className="max-w-2xl">
            <p className="eyebrow text-primary">
              {[profile.city, profile.country].filter(Boolean).join(" · ") ||
                "Welcome to our practice"}
            </p>
            <h1 className="editorial-title mt-5 break-words text-4xl leading-tight sm:text-6xl">
              {profile.display_name}
            </h1>
            <p className="mt-6 whitespace-pre-wrap text-lg leading-8 text-muted-foreground">
              {profile.introduction}
            </p>
            {profile.specialties ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {profile.specialties
                  .split(",")
                  .filter((x) => x.trim())
                  .map((s, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-primary/15 bg-card/80 px-3 py-2 text-sm text-primary"
                    >
                      {s.trim()}
                    </span>
                  ))}
              </div>
            ) : null}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Booking profile={profile} />
              <a
                href="#results"
                className="inline-flex min-h-11 items-center gap-2 text-base font-medium text-primary"
              >
                Explore our results <ArrowRight aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>
      <section
        id="results"
        className="mx-auto max-w-7xl scroll-mt-5 px-5 py-16 sm:px-10 sm:py-24"
      >
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow text-primary">A closer perspective</p>
            <h2 className="editorial-title mt-3 text-3xl sm:text-4xl">
              Stories, thoughtfully shared.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              Selected before-and-after photographs shared by the clinic.
              Individual experiences and results vary.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {total} {total === 1 ? "result" : "results"}
          </span>
        </div>
        {!preview && categories.length > 1 ? (
          <form action={base} className="mb-7 flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="public-category"
                className="block text-sm font-medium"
              >
                Explore by category
              </label>
              <select
                id="public-category"
                name="category"
                defaultValue={category}
                className="mt-2 min-h-11 min-w-52 rounded-lg border border-input bg-card px-3 text-base"
              >
                <option value="">All results</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Show results
            </button>
          </form>
        ) : null}
        {results.length ? (
          <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {results.map((result) => (
              <li key={result.id}>
                <Link
                  href={
                    preview
                      ? `/clinic/preview?result=${result.id}`
                      : `${base}/results/${result.slug}`
                  }
                  className="group block overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/50"
                >
                  <div className="grid grid-cols-2 gap-px bg-border">
                    <ResultImage
                      clinic={profile}
                      result={result}
                      side="before"
                      preview={preview}
                    />
                    <ResultImage
                      clinic={profile}
                      result={result}
                      side="after"
                      preview={preview}
                    />
                  </div>
                  <div className="space-y-3 p-5">
                    <p className="text-sm text-primary">{result.category}</p>
                    <h3 className="flex items-start justify-between gap-3 text-xl font-medium">
                      {result.title}
                      <ArrowUpRight
                        aria-hidden="true"
                        className="size-5 shrink-0 text-primary"
                      />
                    </h3>
                    <p className="line-clamp-2 text-base leading-7 text-muted-foreground">
                      {result.summary}
                    </p>
                    <p className="pt-2 text-sm font-medium text-primary">
                      See the full story →
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-8 text-base leading-7 text-muted-foreground">
            {category
              ? "No published results match this category."
              : "Our gallery is being thoughtfully prepared. Contact the clinic to learn more about our services."}
          </div>
        )}
        {!preview && pages > 1 ? (
          <nav
            aria-label="Gallery pages"
            className="mt-9 flex flex-wrap items-center justify-center gap-4"
          >
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                <ArrowLeft />
                Previous
              </Link>
            ) : null}
            <span className="text-base text-muted-foreground">
              Page {page} of {pages}
            </span>
            {page < pages ? (
              <Link
                href={pageHref(page + 1)}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                More results <ArrowRight />
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
      <ClinicContact profile={profile} />
      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-4 px-5 py-8 text-sm text-muted-foreground sm:px-10">
        <span>{profile.display_name}</span>
        <Link href="/" className="inline-flex min-h-11 items-center">
          Photography workspace by Aperture ↗
        </Link>
      </footer>
    </div>
  );
}
export function ClinicContact({ profile }: { profile: ClinicProfile }) {
  const address = [
    profile.address,
    profile.city,
    profile.region,
    profile.postal_code,
    profile.country,
  ]
    .filter(Boolean)
    .join(", ");
  const phone = profile.phone.replace(/[^\d+]/g, "");
  const whatsapp = whatsappUrl(profile.whatsapp);
  const socials =
    profile.social_links &&
    typeof profile.social_links === "object" &&
    !Array.isArray(profile.social_links)
      ? profile.social_links
      : {};
  return (
    <>
      <section id="contact" className="scroll-mt-5 bg-secondary/50">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-10 sm:py-16 md:grid-cols-2">
          <div>
            <p className="eyebrow text-primary">Let’s connect</p>
            <h2 className="editorial-title mt-4 text-3xl sm:text-4xl">
              Your next step starts here.
            </h2>
            {profile.contact_name ? (
              <p className="mt-5 text-base text-muted-foreground">
                Contact: {profile.contact_name}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Booking profile={profile} />
              {whatsapp && profile.booking_url !== whatsapp ? (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  WhatsApp <ArrowUpRight />
                </a>
              ) : null}
            </div>
          </div>
          <div className="space-y-5 text-base leading-7">
            {address ? (
              <p className="flex items-start gap-3">
                <MapPin
                  aria-hidden="true"
                  className="mt-1 size-5 shrink-0 text-primary"
                />
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-border underline-offset-4"
                >
                  {address}
                  <span className="block text-sm text-primary">
                    Get directions ↗
                  </span>
                </a>
              </p>
            ) : null}
            {phone ? (
              <p className="flex items-center gap-3">
                <Phone aria-hidden="true" className="size-5 text-primary" />
                <a
                  href={`tel:${phone}`}
                  className="inline-flex min-h-11 items-center"
                >
                  {profile.phone}
                </a>
              </p>
            ) : null}
            {profile.email ? (
              <p className="flex items-center gap-3">
                <Mail
                  aria-hidden="true"
                  className="size-5 shrink-0 text-primary"
                />
                <a
                  href={`mailto:${encodeURIComponent(profile.email)}`}
                  className="inline-flex min-h-11 break-all items-center"
                >
                  {profile.email}
                </a>
              </p>
            ) : null}
            {profile.opening_hours ? (
              <p className="flex items-start gap-3">
                <Clock
                  aria-hidden="true"
                  className="mt-1 size-5 shrink-0 text-primary"
                />
                <span className="whitespace-pre-wrap">
                  {profile.opening_hours}
                </span>
              </p>
            ) : null}
            {profile.languages ? <p>Languages: {profile.languages}</p> : null}
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {safeExternalUrl(profile.website) ? (
                <a
                  href={safeExternalUrl(profile.website)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
                >
                  Clinic website ↗
                </a>
              ) : null}
              {socialPlatforms.flatMap((platform) => {
                const value = socials[platform];
                const url =
                  typeof value === "string" ? safeExternalUrl(value) : "";
                return url
                  ? [
                      <a
                        key={platform}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center capitalize text-primary underline underline-offset-4"
                      >
                        {platform} ↗
                      </a>,
                    ]
                  : [];
              })}
            </div>
          </div>
        </div>
      </section>
      {phone || whatsapp || safeExternalUrl(profile.booking_url) ? (
        <nav
          aria-label="Contact clinic"
          className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap justify-center gap-2 border-t border-border bg-card/95 p-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-sm sm:hidden"
        >
          {phone ? (
            <a
              href={`tel:${phone}`}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Call
            </a>
          ) : null}
          {whatsapp && !profile.booking_url ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              WhatsApp
            </a>
          ) : null}
          <Booking profile={profile} />
        </nav>
      ) : null}
    </>
  );
}
export function PublicResultView({
  profile,
  result,
  preview = false,
}: {
  profile: ClinicProfile;
  result: PublicResult;
  preview?: boolean;
}) {
  return (
    <div className="bg-background pb-20">
      <ClinicHeader profile={profile} />
      <article className="mx-auto max-w-6xl px-5 py-10 sm:px-10">
        <Link
          href={
            preview ? "/clinic/preview" : `/clinics/${profile.slug}#results`
          }
          className="inline-flex min-h-11 items-center gap-2 text-base text-primary"
        >
          <ArrowLeft aria-hidden="true" />
          Back to gallery
        </Link>
        <p className="eyebrow mt-7 text-primary">{result.category}</p>
        <h1 className="editorial-title mt-4 max-w-3xl break-words text-4xl sm:text-5xl">
          {result.title}
        </h1>
        <div className="mt-9 grid grid-cols-2 gap-3 sm:gap-6">
          <ResultImage
            clinic={profile}
            result={result}
            side="before"
            preview={preview}
          />
          <ResultImage
            clinic={profile}
            result={result}
            side="after"
            preview={preview}
          />
        </div>
        <div className="mt-8 grid gap-8 rounded-2xl bg-secondary/40 p-6 md:grid-cols-[2fr_1fr]">
          <div>
            <h2 className="text-xl font-medium">About this result</h2>
            <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-muted-foreground">
              {result.summary}
            </p>
            <p className="mt-5 text-sm leading-6 text-muted-foreground">
              Individual results vary. These photographs do not guarantee an
              outcome. Contact the clinic to discuss your individual needs.
            </p>
          </div>
          <dl className="space-y-4 text-base">
            {[
              ["Procedure", result.procedure_type],
              ["Body area", result.body_area],
              ["Treatment interval", result.treatment_interval],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-sm text-muted-foreground">{k}</dt>
                  <dd className="mt-1 font-medium">{v}</dd>
                </div>
              ))}
          </dl>
        </div>
      </article>
      <ClinicContact profile={profile} />
    </div>
  );
}
