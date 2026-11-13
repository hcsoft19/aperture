import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { readSupabaseEnv } from "@/lib/supabase/env";

export type VerifiedUser = {
  id: string;
  email: string | null;
};

/**
 * Verifies the caller from the signed access token.
 * Clinic role comes from organization_members, not from this token.
 * Do not read user_metadata for authorization.
 */
export async function getVerifiedUser(): Promise<VerifiedUser | null> {
  if (!readSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return null;
  }

  const email = data.claims.email;
  return {
    id: data.claims.sub,
    email: typeof email === "string" ? email : null,
  };
}

export async function requireUser() {
  const user = await getVerifiedUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
