"use client"

import { useState, useTransition, useRef } from "react"
import { CheckCircle2, AlertCircle, Send, Users, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { broadcastAdminEmail } from "@/actions/admin/broadcast"
import { useUnsavedChangesWarning } from "@/lib/hooks/useUnsavedChangesWarning"
import { broadcastSchema } from "@/lib/validation/schemas"
import { z } from "zod"
import { FieldError, fieldErrorProps } from "@/components/ui/FieldError"
import { useFocusFirstError } from "@/lib/hooks/useFocusFirstError"

type TargetType = "all" | "single"
type FieldErrors = Partial<Record<
  "subject" | "messageBody" | "ctaLabel" | "ctaUrl" | "targetEmail",
  string[]
>>

interface BroadcastFormProps {
  totalUsers: number
}

export function BroadcastForm({ totalUsers }: BroadcastFormProps) {
  const [subject, setSubject] = useState("")
  const [messageBody, setMessageBody] = useState("")
  const [ctaLabel, setCtaLabel] = useState("")
  const [ctaUrl, setCtaUrl] = useState("")
  const [targetType, setTargetType] = useState<TargetType>("all")
  const [targetEmail, setTargetEmail] = useState("")

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const banner = useRef<HTMLDivElement>(null)
  const focusFirstError = useFocusFirstError({ fallback: banner })
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ count: number } | null>(null)
  const [pending, startTransition] = useTransition()

  useUnsavedChangesWarning(
    !pending &&
      (subject.length > 0 ||
        messageBody.length > 0 ||
        ctaLabel.length > 0 ||
        ctaUrl.length > 0 ||
        targetEmail.length > 0),
  )

  function reset() {
    setSubject("")
    setMessageBody("")
    setCtaLabel("")
    setCtaUrl("")
    setTargetEmail("")
    setTargetType("all")
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFieldErrors({})
    setServerError(null)
    setSuccess(null)

    const input = { subject, messageBody, ctaLabel, ctaUrl, targetType, targetEmail }
    const parsed = broadcastSchema.safeParse(input)
    if (!parsed.success) {
      const errors = z.flattenError(parsed.error).fieldErrors as FieldErrors
      setFieldErrors(errors)
      focusFirstError(errors)
      return
    }

    startTransition(async () => {
      const result = await broadcastAdminEmail(input)

      if (!result.success) {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors as FieldErrors)
          focusFirstError(result.fieldErrors)
        }
        setServerError(result.error)
        return
      }

      setSuccess({ count: result.count })
      reset()
    })
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit} noValidate>
      {success && (
        <div className="flex items-start gap-2 rounded-[8px] border border-accent-ink/40 bg-voltage/10 px-3 py-2.5">
          <CheckCircle2 className="w-4 h-4 text-accent-ink mt-0.5 shrink-0" />
          <p className="font-mono text-[13px] text-ink">
            Email sent to {success.count} recipient{success.count === 1 ? "" : "s"}.
          </p>
        </div>
      )}
      {serverError && (
        <div ref={banner} className="flex items-start gap-2 rounded-[8px] border border-danger-ink/40 bg-ember/10 px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-danger-ink mt-0.5 shrink-0" />
          <p className="font-mono text-[13px] text-ink">{serverError}</p>
        </div>
      )}

      <FieldGroup label="Audience" htmlFor="targetEmail">
        <div className="grid grid-cols-2 gap-2">
          <AudienceOption
            active={targetType === "all"}
            onClick={() => setTargetType("all")}
            icon={Users}
            title="All users"
            subtitle={`${totalUsers} account${totalUsers === 1 ? "" : "s"}`}
          />
          <AudienceOption
            active={targetType === "single"}
            onClick={() => setTargetType("single")}
            icon={User}
            title="Single user"
            subtitle="Send to one email"
          />
        </div>

        {targetType === "single" && (
          <div className="mt-3">
            <Input
              id="targetEmail"
              name="targetEmail"
              type="email"
              placeholder="user@example.com"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              autoComplete="off"
              {...fieldErrorProps("targetEmail", fieldErrors.targetEmail)}
            />
            <FieldError field="targetEmail" errors={fieldErrors.targetEmail} />
          </div>
        )}
      </FieldGroup>

      <FieldGroup label="Subject" htmlFor="subject" required>
        <Input
          id="subject"
          name="subject"
          placeholder="A short, clear headline"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={150}
          {...fieldErrorProps("subject", fieldErrors.subject)}
        />
        <FieldError field="subject" errors={fieldErrors.subject} />
      </FieldGroup>

      <FieldGroup label="Message" htmlFor="messageBody" required>
        <Textarea
          id="messageBody"
          name="messageBody"
          placeholder={`Write your message. Use a blank line to start a new paragraph.\n\nA second paragraph looks like this.`}
          value={messageBody}
          onChange={(e) => setMessageBody(e.target.value)}
          rows={8}
          maxLength={5000}
          {...fieldErrorProps("messageBody", fieldErrors.messageBody)}
        />
        <div className="flex justify-between mt-1">
          <FieldError field="messageBody" errors={fieldErrors.messageBody} />
          <span className="font-mono text-[11px] text-ink-muted ml-auto">
            {messageBody.length}/5000
          </span>
        </div>
      </FieldGroup>

      <FieldGroup label="Call-to-action button (optional)" htmlFor="ctaLabel">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <Input
              id="ctaLabel"
              name="ctaLabel"
              placeholder="Button label (e.g. View dashboard)"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              maxLength={40}
              {...fieldErrorProps("ctaLabel", fieldErrors.ctaLabel)}
            />
            <FieldError field="ctaLabel" errors={fieldErrors.ctaLabel} />
          </div>
          <div>
            <Input
              id="ctaUrl"
              name="ctaUrl"
              type="url"
              placeholder="https://townhall.dev/…"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              {...fieldErrorProps("ctaUrl", fieldErrors.ctaUrl)}
            />
            <FieldError field="ctaUrl" errors={fieldErrors.ctaUrl} />
          </div>
        </div>
        <p className="font-mono text-[11px] text-ink-muted mt-2">
          Provide both fields together or leave both empty.
        </p>
      </FieldGroup>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
        <Button type="submit" disabled={pending} className="gap-2">
          <Send className="w-4 h-4" />
          {pending ? "Sending…" : "Send Email"}
        </Button>
      </div>
    </form>
  )
}

function FieldGroup({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string
  /** Matches the control's id, which is also the schema key its error arrives under. */
  htmlFor: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block font-mono text-[11px] uppercase tracking-[1px] text-ink-muted mb-2">
        {label}
        {required && <span className="text-accent-ink ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

function AudienceOption({
  active,
  onClick,
  icon: Icon,
  title,
  subtitle,
}: {
  active: boolean
  onClick: () => void
  icon: React.ElementType
  title: string
  subtitle: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-[8px] border px-3 py-2.5 text-left transition-colors duration-150",
        active
          ? "border-accent-ink bg-voltage/5"
          : "border-line hover:border-ink-muted",
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0 border",
          active ? "border-accent-ink/40 bg-voltage/10" : "border-line bg-surface",
        )}
      >
        <Icon className={cn("w-4 h-4", active ? "text-accent-ink" : "text-ink-muted")} />
      </div>
      <div className="min-w-0">
        <p className={cn("font-mono text-[13px]", active ? "text-ink" : "text-ink")}>
          {title}
        </p>
        <p className="font-mono text-[11px] text-ink-muted truncate">{subtitle}</p>
      </div>
    </button>
  )
}
