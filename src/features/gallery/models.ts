import { z } from "zod";

export const genderOptions = [
  { value: "", label: "Not recorded" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non_binary", label: "Non-binary" },
  { value: "self_described", label: "Self-described" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;
const dateFilter = z.union([z.literal(""), z.iso.date()]);
export const defaultGalleryFilters = {
  search: "",
  visibility: "all",
  sort: "newest",
  category: "",
  procedure: "",
  product: "",
  bodyArea: "",
  gender: "",
  uploadedFrom: "",
  uploadedTo: "",
  collection: "all",
} as const;
export const galleryFiltersSchema = z
  .object({
    search: z.string().trim().max(80).default(""),
    visibility: z.enum(["all", "shared", "private"]).default("all"),
    sort: z.enum(["newest", "oldest"]).default("newest"),
    category: z.string().trim().max(80).default(""),
    procedure: z.string().trim().max(80).default(""),
    product: z.string().trim().max(120).default(""),
    bodyArea: z.string().trim().max(80).default(""),
    gender: z
      .enum([
        "",
        "female",
        "male",
        "non_binary",
        "self_described",
        "prefer_not_to_say",
      ])
      .default(""),
    uploadedFrom: dateFilter.default(""),
    uploadedTo: dateFilter.default(""),
    collection: z.enum(["all", "clinical", "demo"]).default("all"),
  })
  .refine(
    (value) =>
      !value.uploadedFrom ||
      !value.uploadedTo ||
      value.uploadedFrom <= value.uploadedTo,
    "The end date must be on or after the start date.",
  );
export const galleryPageSchema = galleryFiltersSchema.safeExtend({
  cursor: z
    .object({
      createdAt: z.iso.datetime({ offset: true }),
      id: z.string().uuid(),
    })
    .nullable()
    .default(null),
});
export type GalleryFilters = z.infer<typeof galleryFiltersSchema>;
export type GalleryPageInput = z.infer<typeof galleryPageSchema>;
export type SourceCredit = {
  title: string;
  url: string;
  author: string;
  license: string;
  licenseUrl: string;
};
export type GalleryResult = {
  id: string;
  createdAt: string;
  entryKind: "clinical" | "demo";
  isPlate: boolean;
  sourceCredits: SourceCredit[];
  patientId: string | null;
  patientName: string;
  patientGender: string | null;
  treatmentId: string | null;
  treatmentName: string;
  bodyArea: string;
  category: string;
  procedure: string;
  product: string;
  notes: string | null;
  uploadedAt: string | null;
  shared: boolean;
  angleName: string;
  before: {
    photoId: string | null;
    url: string | null;
    sessionId: string | null;
    date: string;
    width: number | null;
    height: number | null;
  };
  after: {
    photoId: string | null;
    url: string | null;
    sessionId: string | null;
    date: string;
    width: number | null;
    height: number | null;
  };
  alignment: {
    x: number;
    y: number;
    rotation: number;
    scale: number;
    aligned: boolean;
  };
};
export type GalleryPage = {
  items: GalleryResult[];
  nextCursor: GalleryPageInput["cursor"];
  total: number;
};
export type GalleryFacets = {
  categories: string[];
  procedures: string[];
  products: string[];
  bodyAreas: string[];
};
export const emptyGalleryFacets: GalleryFacets = {
  categories: [],
  procedures: [],
  products: [],
  bodyAreas: [],
};
export const GALLERY_PAGE_SIZE = 12;
const alignmentSchema = z.object({
  x: z.number().finite().min(-50).max(50),
  y: z.number().finite().min(-50).max(50),
  rotation: z.number().finite().min(-30).max(30),
  scale: z.number().finite().min(0.5).max(2),
  aligned: z.boolean(),
});
export function galleryAlignment(value: unknown): GalleryResult["alignment"] {
  const parsed = alignmentSchema.safeParse(value);
  return parsed.success
    ? parsed.data
    : { x: 0, y: 0, rotation: 0, scale: 1, aligned: false };
}
export function galleryDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
}
export function sourceCredits(value: unknown): SourceCredit[] {
  const safeUrl = z.url().refine((url) => url.startsWith("https://"));
  const parsed = z
    .array(
      z.object({
        title: z.string(),
        url: safeUrl,
        author: z.string(),
        license: z.string(),
        licenseUrl: safeUrl,
      }),
    )
    .safeParse(value);
  return parsed.success ? parsed.data : [];
}
