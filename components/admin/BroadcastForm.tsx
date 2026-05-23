"use client"

import { useState, useTransition } from "react"
import { CheckCircle2, AlertCircle, Send, Users, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { broadcastAdminEmail } from "@/actions/admin/broadcast"

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
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ count: number } | null>(null)
  const [pending, startTransition] = useTransition()

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

    startTransition(async () => {
      const result = await broadcastAdminEmail({
        subject,
        messageBody,
        ctaLabel,
        ctaUrl,
        targetType,
        targetEmail,
      })

      if (!result.success) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors as FieldErrors)
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
        <div className="flex items-start gap-2 rounded-[8px] border border-voltage/40 bg-voltage/10 px-3 py-2.5">
          <CheckCircle2 className="w-4 h-4 text-voltage mt-0.5 shrink-0" />
          <p className="font-mono text-[13px] text-chalk">
            Email sent to {success.count} recipient{success.count === 1 ? "" : "s"}.
          </p>
        </div>
      )}
      {serverError && (
        <div className="flex items-start gap-2 rounded-[8px] border border-ember/40 bg-ember/10 px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-ember mt-0.5 shrink-0" />
          <p className="font-mono text-[13px] text-chalk">{serverError}</p>
        </div>
      )}

      <FieldGroup label="Audience">
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
              type="email"
              placeholder="user@example.com"
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              autoComplete="off"
            />
            <FieldError errors={fieldErrors.targetEmail} />
          </div>
        )}
      </FieldGroup>

      <FieldGroup label="Subject" required>
        <Input
          placeholder="A short, clear headline"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={150}
        />
        <FieldError errors={fieldErrors.subject} />
      </FieldGroup>

      <FieldGroup label="Message" required>
        <Textarea
          placeholder={`Write your message. Use a blank line to start a new paragraph.\n\nA second paragraph looks like this.`}
          value={messageBody}
          onChange={(e) => setMessageBody(e.target.value)}
          rows={8}
          maxLength={5000}
        />
        <div className="flex justify-between mt-1">
          <FieldError errors={fieldErrors.messageBody} />
          <span className="font-mono text-[11px] text-ash ml-auto">
            {messageBody.length}/5000
          </span>
        </div>
      </FieldGroup>

      <FieldGroup label="Call-to-action button (optional)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <Input
              placeholder="Button label (e.g. View dashboard)"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              maxLength={40}
            />
            <FieldError errors={fieldErrors.ctaLabel} />
          </div>
          <div>
            <Input
              type="url"
              placeholder="https://townhall.dev/…"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
            />
            <FieldError errors={fieldErrors.ctaUrl} />
          </div>
        </div>
        <p className="font-mono text-[11px] text-ash mt-2">
          Provide both fields together or leave both empty.
        </p>
      </FieldGroup>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-iron">
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
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block font-mono text-[11px] uppercase tracking-[1px] text-ash mb-2">
        {label}
        {required && <span className="text-voltage ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null
  return (
    <p className="font-mono text-[12px] text-ember mt-1">{errors[0]}</p>
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
          ? "border-voltage bg-voltage/5"
          : "border-iron hover:border-ash",
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0 border",
          active ? "border-voltage/40 bg-voltage/10" : "border-iron bg-obsidian",
        )}
      >
        <Icon className={cn("w-4 h-4", active ? "text-voltage" : "text-ash")} />
      </div>
      <div className="min-w-0">
        <p className={cn("font-mono text-[13px]", active ? "text-chalk" : "text-chalk")}>
          {title}
        </p>
        <p className="font-mono text-[11px] text-ash truncate">{subtitle}</p>
      </div>
    </button>
  )
}
