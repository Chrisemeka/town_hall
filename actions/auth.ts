"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CONFIRM_EMAIL_PATH, RESET_PASSWORD_PATH } from "@/lib/access";
import {
  emailOnlySchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  toFieldErrors,
  type EmailOnlyInput,
  type ResetPasswordInput,
  type SignInInput,
  type SignUpInput,
  type ValidationFailure,
} from "@/lib/validation/schemas";

export async function signInWithGoogle() {
  const supabase = await createClient();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null) ||
    "http://localhost:3000";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${siteUrl}/api/auth/callback`,
    },
  });

  if (error) {
    console.error("Error signing in with Google:", error.message);
    throw new Error(error.message);
  }

  if (data?.url) {
    redirect(data.url);
  }
}
export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function deleteAccountAction() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { error } = await supabase.rpc("delete_user");
  if (error) throw new Error(error.message);

  await supabase.auth.signOut();
  redirect("/");
}

/* ──────────────────────────────────────────────────────────────
 * Email + password
 *
 * Everything below validates at the boundary with Zod and returns a
 * `{ success: false, error, fieldErrors }` shape the forms already know
 * how to render. A successful action redirects, which in Next throws —
 * so nothing after a redirect() runs.
 * ──────────────────────────────────────────────────────────── */

type AuthResult<T extends Record<string, unknown>> =
  | { success: true }
  | ValidationFailure<T>

/** Where Supabase sends people back to. The OAuth callback handles the
 *  confirmation link too — both arrive as a PKCE `?code=` exchange, so there is
 *  no second route and no branch. */
function callbackUrl(): string {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : null) ||
    "http://localhost:3000"
  return `${site}/api/auth/callback`
}

export async function signUpWithEmail(
  _prev: unknown,
  formData: FormData,
): Promise<AuthResult<SignUpInput>> {
  const parsed = signUpSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
  })
  if (!parsed.success) {
    return {
      success: false,
      error: "Check the highlighted fields.",
      fieldErrors: toFieldErrors<SignUpInput>(parsed.error),
    }
  }

  const { full_name, email, password } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Picked up by the profile backfill in app/api/auth/callback/route.ts.
      // The upsert there cannot fill it — see that file's comment.
      data: { full_name },
      emailRedirectTo: callbackUrl(),
    },
  })

  if (error) {
    // Supabase obfuscates an existing confirmed address rather than saying so,
    // and we must not undo that: "already registered" on a public form tells an
    // attacker which addresses have accounts. A genuine error still surfaces.
    return { success: false, error: error.message }
  }

  redirect(`${CONFIRM_EMAIL_PATH}?email=${encodeURIComponent(email)}`)
}

export async function signInWithEmail(
  _prev: unknown,
  formData: FormData,
): Promise<AuthResult<SignInInput>> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return {
      success: false,
      error: "Check the highlighted fields.",
      fieldErrors: toFieldErrors<SignInInput>(parsed.error),
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    // An unconfirmed address must not read as a wrong password — that sends
    // people off to reset a password that is fine. Supabase distinguishes the
    // two; pass the distinction on.
    if (error.code === "email_not_confirmed") {
      return {
        success: false,
        error:
          "Confirm your email address first — check your inbox for the link, or request another below.",
      }
    }
    return { success: false, error: "That email and password do not match." }
  }

  // Where they land is the gate chain's business, not this action's: the
  // callback route and middleware own terms, account choice and verification.
  redirect("/")
}

/**
 * Re-send the confirmation link.
 *
 * The 60-second cooldown is GoTrue's, not ours — the project's per-user minimum
 * interval between emails. Rebuilding a rate limiter in app code would be a
 * second, weaker answer to a question auth.users.confirmation_sent_at already
 * answers, and it would need a column we have deliberately not added. What this
 * does is refuse to swallow the refusal: without one, this button is an email
 * bomb pointed at whatever address was typed.
 */
export async function resendConfirmation(
  _prev: unknown,
  formData: FormData,
): Promise<AuthResult<EmailOnlyInput>> {
  const parsed = emailOnlySchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) {
    return {
      success: false,
      error: "Check the highlighted fields.",
      fieldErrors: toFieldErrors<EmailOnlyInput>(parsed.error),
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: callbackUrl() },
  })

  if (error) {
    if (error.code === "over_email_send_rate_limit") {
      return {
        success: false,
        error: "A link was just sent. Give it a minute before asking for another.",
      }
    }
    return { success: false, error: error.message }
  }
  return { success: true }
}

/**
 * The response is identical whether or not the address has an account. Anything
 * else is an enumeration oracle — a public form that answers "is this person a
 * user?" for anyone who asks.
 */
export async function requestPasswordReset(
  _prev: unknown,
  formData: FormData,
): Promise<AuthResult<EmailOnlyInput>> {
  const parsed = emailOnlySchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) {
    return {
      success: false,
      error: "Check the highlighted fields.",
      fieldErrors: toFieldErrors<EmailOnlyInput>(parsed.error),
    }
  }

  const supabase = await createClient()
  const site = callbackUrl().replace("/api/auth/callback", "")
  // A failure here is logged, never surfaced: the caller is told the same thing
  // either way, and "we could not send that" leaks that there was somewhere to
  // send it to.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${site}${RESET_PASSWORD_PATH}`,
  })
  if (error) console.error("Password reset request failed:", error.message)

  return { success: true }
}

export async function updatePassword(
  _prev: unknown,
  formData: FormData,
): Promise<AuthResult<ResetPasswordInput>> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm_password: formData.get("confirm_password"),
  })
  if (!parsed.success) {
    return {
      success: false,
      error: "Check the highlighted fields.",
      fieldErrors: toFieldErrors<ResetPasswordInput>(parsed.error),
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // No recovery session: the link expired, or it was opened in a different
  // browser from the one that requested it.
  if (!user) {
    return {
      success: false,
      error: "That reset link has expired. Request a new one.",
    }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { success: false, error: error.message }

  redirect("/")
}
