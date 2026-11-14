"use server";

import { z } from "zod";
import { getWorkspace } from "@/features/access/workspace";
import {
  galleryPageSchema,
  type GalleryPage,
  type GalleryResult,
} from "./models";
import { getClinicResult, listClinicResults } from "./queries";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

export async function loadGalleryPage(
  input: unknown,
): Promise<Result<GalleryPage>> {
  const parsed = galleryPageSchema.safeParse(input);
  const workspace = await getWorkspace();
  if (
    !parsed.success ||
    workspace?.kind !== "staff" ||
    !workspace.activeMembership
  )
    return { ok: false, message: "This clinic gallery is not available." };
  try {
    return {
      ok: true,
      data: await listClinicResults(
        workspace.activeMembership.organizationId,
        parsed.data,
      ),
    };
  } catch {
    return {
      ok: false,
      message: "The gallery could not be loaded. Please try again.",
    };
  }
}

export async function loadGalleryResult(
  input: unknown,
): Promise<Result<GalleryResult>> {
  const parsed = z.string().uuid().safeParse(input);
  const workspace = await getWorkspace();
  if (
    !parsed.success ||
    workspace?.kind !== "staff" ||
    !workspace.activeMembership
  )
    return { ok: false, message: "This result is not available." };
  try {
    const result = await getClinicResult(
      workspace.activeMembership.organizationId,
      parsed.data,
    );
    return result
      ? { ok: true, data: result }
      : { ok: false, message: "This result is not available." };
  } catch {
    return {
      ok: false,
      message: "This result could not be loaded. Please try again.",
    };
  }
}
