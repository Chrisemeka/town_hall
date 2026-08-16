"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveAccount } from "@/lib/auth";
import { CHOOSE_ACCOUNT_PATH, homeFor } from "@/lib/access";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function acceptTerms() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Use the admin client so RLS on `profiles` can't block the write.
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ accepted_terms_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to record terms acceptance:", error.message);
    throw new Error("Could not save your acceptance. Please try again.");
  }

  // There is no single landing page any more — a fresh signup has no account
  // record yet and goes on to pick one; a returning user goes to whichever
  // account is active.
  const resolved = await getActiveAccount();
  redirect(resolved?.active ? homeFor(resolved.active) : CHOOSE_ACCOUNT_PATH);
}

// Append a tour name to the user's `seen_tours` array on `profiles`. Idempotent —
// if the tour is already in the array, this is a no-op.
export async function markTourSeen(tourName: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!tourName || typeof tourName !== "string") {
    return { ok: false, error: "Invalid tour name." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const admin = createAdminClient();

  const { data: profile, error: readError } = await admin
    .from("profiles")
    .select("seen_tours")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) {
    console.error("Failed to read seen_tours:", readError.message);
    return { ok: false, error: "Could not load your tour state." };
  }

  const current = (profile?.seen_tours as string[] | null) ?? [];
  if (current.includes(tourName)) {
    return { ok: true };
  }

  const next = [...current, tourName];
  const { error: writeError } = await admin
    .from("profiles")
    .update({ seen_tours: next })
    .eq("id", user.id);

  if (writeError) {
    console.error("Failed to update seen_tours:", writeError.message);
    return { ok: false, error: "Could not save your progress." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
