import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  // redirect() throws in Next, which is how a successful action ends.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }))
// The limiter's own behaviour is lib/__tests__/rateLimitDb.test.ts. Here it
// passes unless a test says otherwise, and never reaches the admin client.
vi.mock("@/lib/rateLimitDb", () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true })),
  clientIp: vi.fn(() => "203.0.113.7"),
}))

import {
  requestPasswordReset,
  resendConfirmation,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  updatePassword,
} from "@/actions/auth"
import { createClient } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rateLimitDb"

type AuthStub = {
  signInWithOAuth?: ReturnType<typeof vi.fn>
  signUp?: ReturnType<typeof vi.fn>
  signInWithPassword?: ReturnType<typeof vi.fn>
  resend?: ReturnType<typeof vi.fn>
  resetPasswordForEmail?: ReturnType<typeof vi.fn>
  getUser?: ReturnType<typeof vi.fn>
  updateUser?: ReturnType<typeof vi.fn>
}

function given(auth: AuthStub) {
  vi.mocked(createClient).mockResolvedValue({ auth } as unknown as Awaited<
    ReturnType<typeof createClient>
  >)
  return auth
}

/** Every auth form now carries a Turnstile token; `null` leaves it off. */
const fd = (fields: Record<string, string>, captcha: string | null = "tok") => {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.append(k, v)
  if (captcha !== null) f.append("captcha_token", captcha)
  return f
}

const VALID_SIGNUP = {
  full_name: "Ada Lovelace",
  email: "ada@twnhall.com",
  password: "correcthorse",
  confirm_password: "correcthorse",
}

beforeEach(() => vi.clearAllMocks())

describe("signUpWithEmail", () => {
  it("passes full_name through user_metadata and redirects to the gate", async () => {
    const auth = given({ signUp: vi.fn().mockResolvedValue({ error: null }) })

    await expect(signUpWithEmail(null, fd(VALID_SIGNUP))).rejects.toThrow(
      "NEXT_REDIRECT:/confirm-email?email=ada%40twnhall.com",
    )

    // options.data is the only route the name has: the callback profile upsert
    // is ignoreDuplicates and the row already exists by the time it runs.
    expect(auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@twnhall.com",
        password: "correcthorse",
        options: expect.objectContaining({
          data: { full_name: "Ada Lovelace" },
          emailRedirectTo: expect.stringContaining("/api/auth/callback"),
        }),
      }),
    )
  })

  it("lowercases the address so one account cannot be approached two ways", async () => {
    const auth = given({ signUp: vi.fn().mockResolvedValue({ error: null }) })
    await expect(
      signUpWithEmail(null, fd({ ...VALID_SIGNUP, email: "Ada@Twnhall.com" })),
    ).rejects.toThrow("NEXT_REDIRECT:/confirm-email?email=ada%40twnhall.com")
    expect(auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ada@twnhall.com" }),
    )
  })

  it("rejects a short password without calling Supabase", async () => {
    const auth = given({ signUp: vi.fn() })
    const r = await signUpWithEmail(
      null,
      fd({ ...VALID_SIGNUP, password: "short", confirm_password: "short" }),
    )
    expect(r.success).toBe(false)
    expect(r.success === false && r.fieldErrors?.password).toBeTruthy()
    expect(auth.signUp).not.toHaveBeenCalled()
  })

  it("reports a mismatch on confirm_password, not on password", async () => {
    // That is the field the user should be taken to. Pointing at `password`
    // invites them to retype the one that was probably right.
    const r = await signUpWithEmail(
      null,
      fd({ ...VALID_SIGNUP, confirm_password: "somethingelse" }),
    )
    expect(r.success === false && r.fieldErrors?.confirm_password).toBeTruthy()
    expect(r.success === false && r.fieldErrors?.password).toBeFalsy()
  })

  it("rejects an invalid address", async () => {
    const r = await signUpWithEmail(null, fd({ ...VALID_SIGNUP, email: "nope" }))
    expect(r.success === false && r.fieldErrors?.email).toBeTruthy()
  })

  it("does not disclose that an address is already registered", async () => {
    // Supabase obfuscates this by returning success for an existing confirmed
    // address. The action must not undo that by inspecting and reporting it.
    given({ signUp: vi.fn().mockResolvedValue({ error: null }) })
    await expect(signUpWithEmail(null, fd(VALID_SIGNUP))).rejects.toThrow(
      "NEXT_REDIRECT:/confirm-email",
    )
  })
})

describe("signInWithEmail", () => {
  it("signs in and hands off to the gate chain", async () => {
    given({ signInWithPassword: vi.fn().mockResolvedValue({ error: null }) })
    await expect(
      signInWithEmail(null, fd({ email: "ada@twnhall.com", password: "correcthorse" })),
    ).rejects.toThrow("NEXT_REDIRECT:/")
  })

  it("does not distinguish a wrong password from an unknown address", async () => {
    given({
      signInWithPassword: vi
        .fn()
        .mockResolvedValue({ error: { code: "invalid_credentials", message: "nope" } }),
    })
    const r = await signInWithEmail(
      null,
      fd({ email: "ada@twnhall.com", password: "wrong" }),
    )
    expect(r).toEqual({ success: false, error: "That email and password do not match." })
  })

  it("names an unconfirmed address rather than blaming the password", async () => {
    // Reporting this as a bad password sends people off to reset one that is
    // fine, and they never find the real problem.
    given({
      signInWithPassword: vi
        .fn()
        .mockResolvedValue({ error: { code: "email_not_confirmed", message: "x" } }),
    })
    const r = await signInWithEmail(
      null,
      fd({ email: "ada@twnhall.com", password: "correcthorse" }),
    )
    expect(r.success).toBe(false)
    expect(r.success === false && r.error).toMatch(/Confirm your email/)
  })

  it("does not tell someone their password is too short at the sign-in box", async () => {
    // An account may predate the current minimum, and the length of what is
    // stored is not something to volunteer.
    const auth = given({ signInWithPassword: vi.fn().mockResolvedValue({ error: null }) })
    await expect(
      signInWithEmail(null, fd({ email: "ada@twnhall.com", password: "old" })),
    ).rejects.toThrow("NEXT_REDIRECT:/")
    expect(auth.signInWithPassword).toHaveBeenCalled()
  })
})

describe("resendConfirmation", () => {
  it("surfaces the rate limit rather than swallowing it", async () => {
    // Without this the button is an email bomb pointed at whatever address was
    // typed. The 60s enforcement is GoTrue's; not hiding the refusal is ours.
    given({
      resend: vi
        .fn()
        .mockResolvedValue({ error: { code: "over_email_send_rate_limit", message: "x" } }),
    })
    const r = await resendConfirmation(null, fd({ email: "ada@twnhall.com" }))
    expect(r.success).toBe(false)
    expect(r.success === false && r.error).toMatch(/minute/)
  })

  it("resends for a valid address", async () => {
    const auth = given({ resend: vi.fn().mockResolvedValue({ error: null }) })
    const r = await resendConfirmation(null, fd({ email: "ada@twnhall.com" }))
    expect(r).toEqual({ success: true })
    expect(auth.resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signup", email: "ada@twnhall.com" }),
    )
  })

  it("rejects a malformed address before sending anything", async () => {
    const auth = given({ resend: vi.fn() })
    const r = await resendConfirmation(null, fd({ email: "not-an-email" }))
    expect(r.success).toBe(false)
    expect(auth.resend).not.toHaveBeenCalled()
  })
})

describe("requestPasswordReset", () => {
  it("answers the same for an address that exists and one that does not", async () => {
    // Any difference here turns a public form into an oracle for who has an
    // account. Both branches must be indistinguishable to the caller.
    given({ resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }) })
    const known = await requestPasswordReset(null, fd({ email: "ada@twnhall.com" }))

    given({
      resetPasswordForEmail: vi
        .fn()
        .mockResolvedValue({ error: { message: "User not found" } }),
    })
    const unknown = await requestPasswordReset(null, fd({ email: "nobody@twnhall.com" }))

    expect(known).toEqual({ success: true })
    expect(unknown).toEqual(known)
  })

  it("sends the link through the callback, which exchanges the code", async () => {
    const auth = given({ resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }) })
    await requestPasswordReset(null, fd({ email: "ada@twnhall.com" }))
    // Straight to /reset-password, the PKCE code is never exchanged and every
    // link reads as expired on arrival.
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("ada@twnhall.com", {
      redirectTo: expect.stringMatching(/\/api\/auth\/callback\?next=\/reset-password$/),
      captchaToken: "tok",
    })
  })

  it("still rejects a malformed address", async () => {
    const auth = given({ resetPasswordForEmail: vi.fn() })
    const r = await requestPasswordReset(null, fd({ email: "nope" }))
    expect(r.success).toBe(false)
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })
})

describe("updatePassword", () => {
  it("refuses without a recovery session", async () => {
    const auth = given({
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      updateUser: vi.fn(),
    })
    const r = await updatePassword(
      null,
      fd({ password: "correcthorse", confirm_password: "correcthorse" }),
    )
    expect(r.success).toBe(false)
    expect(r.success === false && r.error).toMatch(/expired/)
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it("sets the password when the session is there", async () => {
    const auth = given({
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    })
    await expect(
      updatePassword(
        null,
        fd({ password: "correcthorse", confirm_password: "correcthorse" }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/")
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "correcthorse" })
  })

  it("rejects a mismatch before touching the session", async () => {
    const auth = given({ getUser: vi.fn(), updateUser: vi.fn() })
    const r = await updatePassword(
      null,
      fd({ password: "correcthorse", confirm_password: "different" }),
    )
    expect(r.success === false && r.fieldErrors?.confirm_password).toBeTruthy()
    expect(auth.getUser).not.toHaveBeenCalled()
  })
})

describe("the auth rate limits", () => {
  const limited = () => vi.mocked(checkRateLimit).mockResolvedValue({ ok: false, retryAfter: 600 })
  beforeEach(() => vi.mocked(checkRateLimit).mockResolvedValue({ ok: true }))

  it("a limited sign-in is identical for a registered and an unregistered address, and never calls Supabase", async () => {
    limited()
    const auth = given({
      // Would answer differently per address if it were ever reached.
      signInWithPassword: vi.fn(async ({ email }: { email: string }) => ({
        error: email === "ada@twnhall.com" ? { code: "invalid_credentials" } : { code: "user_not_found" },
      })),
    })

    const real = await signInWithEmail(null, fd({ email: "ada@twnhall.com", password: "wrongwrong" }))
    const invented = await signInWithEmail(null, fd({ email: "nobody@nowhere.com", password: "wrongwrong" }))

    expect(real).toEqual(invented)
    expect(real).toEqual({ success: false, error: "Too many attempts. Try again in 10 minutes." })
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it("sign-in counts the IP and the normalised address separately", async () => {
    given({ signInWithPassword: vi.fn(async () => ({ error: null })) })
    await expect(
      signInWithEmail(null, fd({ email: "Ada@Twnhall.com", password: "correcthorse" })),
    ).rejects.toThrow("NEXT_REDIRECT")
    expect(checkRateLimit).toHaveBeenCalledWith(["signin:ip", "203.0.113.7"], ["signin:email", "ada@twnhall.com"])
  })

  it("limits sign-up, resend and reset before any email is sent", async () => {
    limited()
    const auth = given({ signUp: vi.fn(), resend: vi.fn(), resetPasswordForEmail: vi.fn() })

    expect((await signUpWithEmail(null, fd(VALID_SIGNUP))).success).toBe(false)
    expect((await resendConfirmation(null, fd({ email: "ada@twnhall.com" }))).success).toBe(false)
    expect((await requestPasswordReset(null, fd({ email: "ada@twnhall.com" }))).success).toBe(false)
    expect(auth.signUp).not.toHaveBeenCalled()
    expect(auth.resend).not.toHaveBeenCalled()
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })
})

describe("the Turnstile token", () => {
  const CAPTCHA_FAILED = { error: { code: "captcha_failed", message: "captcha protection" } }
  const forms = [
    ["signUpWithEmail", () => signUpWithEmail, VALID_SIGNUP],
    ["signInWithEmail", () => signInWithEmail, { email: "ada@twnhall.com", password: "correcthorse" }],
    ["resendConfirmation", () => resendConfirmation, { email: "ada@twnhall.com" }],
    ["requestPasswordReset", () => requestPasswordReset, { email: "ada@twnhall.com" }],
  ] as const
  const allAuth = () =>
    given({
      signUp: vi.fn(async () => CAPTCHA_FAILED),
      signInWithPassword: vi.fn(async () => CAPTCHA_FAILED),
      resend: vi.fn(async () => CAPTCHA_FAILED),
      resetPasswordForEmail: vi.fn(async () => CAPTCHA_FAILED),
    })

  beforeEach(() => vi.mocked(checkRateLimit).mockResolvedValue({ ok: true }))

  it.each(forms)("%s refuses a missing token as a field error, before Supabase or the limiter", async (_, action, fields) => {
    const auth = allAuth()
    const r = await action()(null, fd(fields, null))
    expect(r.success === false && r.fieldErrors?.captcha_token).toEqual(["Complete the verification above."])
    expect(checkRateLimit).not.toHaveBeenCalled()
    for (const call of Object.values(auth)) expect(call).not.toHaveBeenCalled()
  })

  it.each(forms)("%s answers GoTrue's captcha refusal as a widget error — after spending a rate-limit hit", async (_, action, fields) => {
    // Not "wrong password", and on reset not the pretend success: a captcha
    // refusal says nothing about the address. The hit is spent because the
    // limiter runs first, and checking the token first would need the secret
    // key in the app (SPEC-turnstile §5).
    allAuth()
    const r = await action()(null, fd(fields))
    expect(r.success === false && r.fieldErrors?.captcha_token?.[0]).toMatch(/expired/)
    expect(checkRateLimit).toHaveBeenCalledTimes(1)
  })

  it("reaches every Supabase call as captchaToken", async () => {
    const auth = given({
      signUp: vi.fn(async () => ({ error: null })),
      signInWithPassword: vi.fn(async () => ({ error: null })),
      resend: vi.fn(async () => ({ error: null })),
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    })
    await expect(signUpWithEmail(null, fd(VALID_SIGNUP))).rejects.toThrow("NEXT_REDIRECT")
    await expect(
      signInWithEmail(null, fd({ email: "ada@twnhall.com", password: "correcthorse" })),
    ).rejects.toThrow("NEXT_REDIRECT")
    await resendConfirmation(null, fd({ email: "ada@twnhall.com" }))
    await requestPasswordReset(null, fd({ email: "ada@twnhall.com" }))

    const opts = { options: expect.objectContaining({ captchaToken: "tok" }) }
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining(opts))
    expect(auth.signInWithPassword).toHaveBeenCalledWith(expect.objectContaining(opts))
    expect(auth.resend).toHaveBeenCalledWith(expect.objectContaining(opts))
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "ada@twnhall.com",
      expect.objectContaining({ captchaToken: "tok" }),
    )
  })
  it("is not asked of Google sign-in, which has no form post to carry one", async () => {
    const auth = given({
      signInWithOAuth: vi.fn(async () => ({ data: { url: "https://accounts.google.com/x" }, error: null })),
    })
    await expect(signInWithGoogle()).rejects.toThrow("NEXT_REDIRECT:https://accounts.google.com/x")
    expect(JSON.stringify(auth.signInWithOAuth!.mock.calls)).not.toMatch(/captcha/i)
  })
})
