"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

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

  redirect("/onboarding");
}

export async function completeOnboarding() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ completed_onboarding_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to record onboarding completion:", error.message);
    throw new Error("Could not save onboarding. Please try again.");
  }

  redirect("/explore");
}
