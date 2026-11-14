"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Camera,
  Check,
  Images,
  LoaderCircle,
  LockKeyhole,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadGalleryPage } from "./actions";
import {
  defaultGalleryFilters,
  galleryFiltersSchema,
  emptyGalleryFacets,
  genderOptions,
  type GalleryFacets,
  type GalleryFilters,
  type GalleryPage,
  type GalleryResult,
} from "./models";
import { ResultDialog } from "./result-dialog";

const defaults: GalleryFilters = { ...defaultGalleryFilters };

export function ClinicGallery({
  clinicName,
  initialPage,
  initialError = "",
  facets = emptyGalleryFacets,
}: {
  clinicName: string;
  initialPage: GalleryPage;
  initialError?: string;
  facets?: GalleryFacets;
}) {
  const [page, setPage] = useState(initialPage);
  const [draft, setDraft] = useState(defaults);
  const [filters, setFilters] = useState(defaults);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(initialError);
  const [continuous, setContinuous] = useState(false);
  const hasFilters = Object.entries(filters).some(
    ([key, value]) => value !== defaults[key as keyof GalleryFilters],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const requestId = useRef(0);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (nextFilters: GalleryFilters, append: boolean) => {
      if (append && busy.current) return;
      const request = ++requestId.current;
      busy.current = true;
      setPending(true);
      setMessage("");
      try {
        const response = await loadGalleryPage({
          ...nextFilters,
          cursor: append ? page.nextCursor : null,
        });
        if (request !== requestId.current) return;
        if (response.ok) {
          setPage((current) =>
            append
              ? {
                  items: [
                    ...current.items,
                    ...response.data.items.filter(
                      (item) =>
                        !current.items.some(
                          (existing) => existing.id === item.id,
                        ),
                    ),
                  ],
                  nextCursor: response.data.nextCursor,
                  total: current.total,
                }
              : response.data,
          );
          setAnnouncement(
            `${response.data.items.length} ${append ? "more " : ""}results loaded.`,
          );
        } else {
          setMessage(response.message);
          setContinuous(false);
        }
      } catch {
        if (request === requestId.current) {
          setMessage("The gallery could not be loaded. Please try again.");
          setContinuous(false);
        }
      } finally {
        if (request === requestId.current) {
          setPending(false);
          busy.current = false;
        }
      }
    },
    [page.nextCursor],
  );

  useEffect(() => {
    if (
      !continuous ||
      !page.nextCursor ||
      pending ||
      selected ||
      message ||
      !sentinel.current ||
      typeof IntersectionObserver === "undefined"
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          void load(filters, true);
      },
      { rootMargin: "240px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [continuous, page.nextCursor, pending, selected, message, filters, load]);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = galleryFiltersSchema.safeParse(draft);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Check the filters.");
      return;
    }
    setFilters(parsed.data);
    void load(parsed.data, false);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow mb-3 text-primary">{clinicName}</p>
          <h1 className="editorial-title text-4xl sm:text-5xl">
            Every journey, in view.
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
            Your clinic’s photographs and before-and-after comparisons. Find a
            result, take a closer look, and follow the full story.
          </p>
        </div>
        <Link
          href="/capture"
          className={buttonVariants({
            size: "lg",
            className: "self-start shrink-0",
          })}
        >
          <Camera aria-hidden="true" />
          New capture
        </Link>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-secondary/60 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-card text-primary">
            <Images aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-lg font-medium">The results collection</p>
            <p className="text-sm text-muted-foreground">
              Saved sessions, comparisons & credited references
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-2 text-sm font-medium text-primary">
          <LockKeyhole aria-hidden="true" className="size-4" />
          Private to your clinic
        </span>
      </div>
      <section aria-labelledby="gallery-heading">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="gallery-heading" className="text-xl font-medium">
            Photographs & comparisons{" "}
            <span className="ml-2 rounded-full bg-muted px-2.5 py-1 text-sm text-muted-foreground">
              {page.total}
            </span>
          </h2>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={continuous}
              onChange={(event) => setContinuous(event.target.checked)}
              className="size-4 accent-primary"
            />
            Continuous scroll
          </label>
        </div>
        <form
          onSubmit={apply}
          className="mb-6 rounded-xl border border-border bg-card p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_200px_auto]">
            <div>
              <Label htmlFor="gallery-search">
                Search treatments or patients
              </Label>
              <div className="relative mt-2">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-3 left-3 size-5 text-muted-foreground"
                />
                <Input
                  id="gallery-search"
                  value={draft.search}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  maxLength={80}
                  placeholder="Search the collection"
                  className="pl-10"
                />
              </div>
            </div>
            <GallerySelect
              id="gallery-category"
              label="Category"
              value={draft.category}
              options={facets.categories}
              onChange={(value) =>
                setDraft((current) => ({ ...current, category: value }))
              }
            />
            <Button
              type="submit"
              size="lg"
              variant="outline"
              className="self-end"
              disabled={pending}
            >
              <SlidersHorizontal aria-hidden="true" />
              Apply filters
            </Button>
          </div>
          <details className="mt-3 border-t border-border pt-1">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-primary">
              More filters · procedure, product, date & gender
            </summary>
            <div className="grid gap-4 pt-3 sm:grid-cols-2 xl:grid-cols-3">
              <GallerySelect
                id="gallery-procedure"
                label="Procedure / type"
                value={draft.procedure}
                options={facets.procedures}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, procedure: value }))
                }
              />
              <GallerySelect
                id="gallery-product"
                label="Product / drug"
                value={draft.product}
                options={facets.products}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, product: value }))
                }
              />
              <GallerySelect
                id="gallery-body"
                label="Body area"
                value={draft.bodyArea}
                options={facets.bodyAreas}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, bodyArea: value }))
                }
              />
              <div>
                <Label htmlFor="gallery-gender">
                  Patient gender (optional)
                </Label>
                <select
                  id="gallery-gender"
                  value={draft.gender}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      gender: event.target.value as GalleryFilters["gender"],
                    }))
                  }
                  className="mt-2 min-h-11 w-full rounded-lg border border-input bg-card px-3 text-base"
                >
                  <option value="">Any gender</option>
                  {genderOptions
                    .filter((option) => option.value)
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <Label htmlFor="gallery-sharing">Patient sharing</Label>
                <select
                  id="gallery-sharing"
                  value={draft.visibility}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      visibility: event.target
                        .value as GalleryFilters["visibility"],
                    }))
                  }
                  className="mt-2 min-h-11 w-full rounded-lg border border-input bg-card px-3 text-base"
                >
                  <option value="all">All sharing states</option>
                  <option value="shared">Shared</option>
                  <option value="private">Not shared</option>
                </select>
              </div>
              <div>
                <Label htmlFor="gallery-collection">Collection</Label>
                <select
                  id="gallery-collection"
                  value={draft.collection}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      collection: event.target
                        .value as GalleryFilters["collection"],
                    }))
                  }
                  className="mt-2 min-h-11 w-full rounded-lg border border-input bg-card px-3 text-base"
                >
                  <option value="all">All collections</option>
                  <option value="clinical">Clinic comparisons</option>
                  <option value="demo">Licensed reference demos</option>
                </select>
              </div>
              <div>
                <Label htmlFor="gallery-from">Uploaded from</Label>
                <Input
                  id="gallery-from"
                  type="date"
                  value={draft.uploadedFrom}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      uploadedFrom: event.target.value,
                    }))
                  }
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="gallery-to">Uploaded until</Label>
                <Input
                  id="gallery-to"
                  type="date"
                  value={draft.uploadedTo}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      uploadedTo: event.target.value,
                    }))
                  }
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="gallery-sort">Sort by</Label>
                <select
                  id="gallery-sort"
                  value={draft.sort}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sort: event.target.value as GalleryFilters["sort"],
                    }))
                  }
                  className="mt-2 min-h-11 w-full rounded-lg border border-input bg-card px-3 text-base"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
            </div>
          </details>
        </form>
        {hasFilters ? (
          <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <p>
              Filtered collection{" "}
              {filters.search ? `· “${filters.search}”` : ""}
              {filters.category ? ` · ${filters.category}` : ""}
            </p>
            <button
              type="button"
              onClick={() => {
                setDraft(defaults);
                setFilters(defaults);
                void load(defaults, false);
              }}
              className="min-h-11 font-medium text-primary underline underline-offset-4"
              disabled={pending}
            >
              Clear filters
            </button>
          </div>
        ) : null}
        <p className="sr-only" role="status" aria-live="polite">
          {announcement}
        </p>
        {message ? (
          <div
            role="alert"
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted p-5"
          >
            <p className="text-base">{message}</p>
            <Button
              variant="outline"
              size="lg"
              onClick={() => void load(filters, false)}
              disabled={pending}
            >
              Try again
            </Button>
          </div>
        ) : null}
        <div aria-busy={pending}>
          {page.items.length ? (
            <ul
              className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3"
              aria-label="Clinic before-and-after results"
            >
              {page.items.map((result) => (
                <li key={result.id}>
                  <ResultCard
                    result={result}
                    onOpen={() => setSelected(result.id)}
                  />
                </li>
              ))}
            </ul>
          ) : !pending && !message ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-14 text-center">
              <Images
                aria-hidden="true"
                className="mx-auto mb-4 size-9 text-primary"
              />
              <h3 className="text-xl font-medium">
                {hasFilters
                  ? "No results match these filters."
                  : "Your first result belongs here."}
              </h3>
              <p className="mx-auto mt-3 max-w-md text-base leading-7 text-muted-foreground">
                {hasFilters
                  ? "Try a different treatment or clear the filters to explore the full collection."
                  : "Finish a baseline and follow-up, then save their comparison. It will appear in your clinic’s collection automatically."}
              </p>
              <Link
                href="/capture"
                className={buttonVariants({ size: "lg", className: "mt-6" })}
              >
                <Camera aria-hidden="true" />
                Open guided capture
              </Link>
            </div>
          ) : null}
          {pending ? (
            <div
              className="flex min-h-24 items-center justify-center gap-3 text-base text-muted-foreground"
              role="status"
            >
              <LoaderCircle
                aria-hidden="true"
                className="size-5 animate-spin motion-reduce:animate-none"
              />
              Loading results…
            </div>
          ) : null}
        </div>
        <div ref={sentinel} aria-hidden="true" className="h-3" />
        {page.items.length ? (
          <footer className="mt-5 flex flex-col items-center gap-3 border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">
              {page.items.length} of {page.total} results
            </p>
            {page.nextCursor ? (
              <Button
                size="lg"
                variant="outline"
                onClick={() => void load(filters, true)}
                disabled={pending}
              >
                <ArrowDown aria-hidden="true" />
                Load more results
              </Button>
            ) : (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Check aria-hidden="true" className="size-4" />
                You’re up to date with this collection.
              </p>
            )}
          </footer>
        ) : null}
      </section>
      {selected ? (
        <ResultDialog
          key={selected}
          resultId={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function ResultCard({
  result,
  onOpen,
}: {
  result: GalleryResult;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View result: ${result.treatmentName}, ${result.patientName}`}
      className="group block w-full overflow-hidden rounded-2xl border border-border bg-card text-left transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      {result.entryKind === "session" ? (
        <div className="relative grid grid-cols-2 gap-px bg-border">
          <div className="relative aspect-[3/4] bg-muted">
            <PreviewPhoto
              resultId={result.id}
              side="before"
              alt={result.angleName}
            />
            <span className="absolute bottom-3 left-3 rounded-md bg-card/95 px-2 py-1 text-sm">
              Saved session
            </span>
          </div>
          <div className="flex flex-col items-center justify-center gap-3 bg-secondary/50 p-4 text-center">
            <Camera aria-hidden="true" className="size-6 text-primary" />
            <span className="text-base font-medium">Photographs saved</span>
            <span className="text-sm leading-6 text-muted-foreground">
              Open the case to review views and continue the follow-up.
            </span>
          </div>
        </div>
      ) : result.isPlate ? (
        <div className="relative aspect-[3/2] overflow-hidden bg-muted">
          <PreviewPhoto
            resultId={result.id}
            side="before"
            alt={`Published before-and-after reference: ${result.treatmentName}`}
          />
          <span className="absolute top-3 left-3 rounded-full bg-card/95 px-2.5 py-1 text-xs font-medium text-primary">
            Before & after · reference
          </span>
        </div>
      ) : (
        <div className="relative grid grid-cols-2 gap-px bg-border">
          {[
            { label: "Before", side: "before" },
            { label: "After", side: "after" },
          ].map((photo) => (
            <div
              key={photo.label}
              className="relative aspect-[3/4] overflow-hidden bg-muted"
            >
              <PreviewPhoto
                resultId={result.id}
                side={photo.side}
                alt={`${photo.label}: ${result.angleName}`}
              />
              <span className="absolute bottom-3 left-3 rounded-md bg-card/95 px-2.5 py-1 text-xs font-medium shadow-sm">
                {photo.label}
              </span>
            </div>
          ))}
          <span className="absolute top-3 left-3 rounded-full bg-card/95 px-2.5 py-1 text-xs font-medium text-primary">
            {result.angleName}
          </span>
        </div>
      )}
      <div className="p-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {result.category} · {result.bodyArea}
          </p>
          <ArrowUpRight
            aria-hidden="true"
            className="size-5 shrink-0 text-primary"
          />
        </div>
        <h3 className="text-lg font-medium leading-snug tracking-tight">
          {result.treatmentName}
        </h3>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">
            {result.patientName}
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-primary">
            {result.entryKind === "demo"
              ? "Reference demo"
              : result.shared
                ? "Shared"
                : "Not shared"}
          </span>
        </div>
        <span className="mt-3 inline-flex min-h-7 items-center gap-2 text-sm font-medium text-primary">
          View full result{" "}
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </span>
        {result.sourceCredits.length ? (
          <span className="mt-2 block text-xs leading-5 text-muted-foreground">
            Image: {result.sourceCredits[0].author} ·{" "}
            {result.sourceCredits[0].license}
          </span>
        ) : null}
      </div>
    </button>
  );
}
function PreviewPhoto({
  resultId,
  side,
  alt,
}: {
  resultId: string;
  side: string;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
      Preview unavailable. Open result to view the photograph.
    </span>
  ) : (
    <Image
      src={`/api/gallery/previews/${resultId}?side=${side}`}
      alt={alt}
      fill
      unoptimized
      sizes="(min-width: 1024px) 360px, 90vw"
      loading="lazy"
      className="object-contain"
      onError={() => setFailed(true)}
    />
  );
}
function GallerySelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-11 w-full rounded-lg border border-input bg-card px-3 text-base"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
