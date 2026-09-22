"use client"

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"

export type SignupPoint = { date: string; count: number }

/*
 * Recharts takes colours as props, not classes, so these read the CSS custom
 * properties directly — the same variables the utilities compile to, so the
 * chart follows the theme without a second palette to keep in step.
 *
 * The series is accent-INK rather than the Voltage literal: a Voltage line on
 * Bone is 1.02:1, which is a chart nobody can see.
 */
export function SignupsChart({
  data,
  title = "Signups",
  subtitle = "New accounts per day, last 30 days.",
}: {
  data: SignupPoint[]
  title?: string
  subtitle?: string
}) {
  return (
    <div className="bg-surface-raised border border-line rounded-[12px] p-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
      <h3 className="font-syne font-bold text-[16px] text-ink mb-1">{title}</h3>
      <p className="font-mono text-[12px] text-ink-muted mb-4">{subtitle}</p>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="signupsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent-ink)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--color-accent-ink)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="var(--color-ink-muted)"
              tick={{ fontSize: 11, fontFamily: "var(--font-dm-mono)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-line)" }}
              tickFormatter={(v: string) => v.slice(5)}
              minTickGap={24}
            />
            <YAxis
              stroke="var(--color-ink-muted)"
              tick={{ fontSize: 11, fontFamily: "var(--font-dm-mono)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={32}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-accent-ink)", strokeOpacity: 0.2 }}
              contentStyle={{
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-line)",
                borderRadius: 8,
                fontFamily: "var(--font-dm-mono)",
                fontSize: 12,
                color: "var(--color-ink)",
              }}
              labelStyle={{ color: "var(--color-ink-muted)", marginBottom: 4 }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="var(--color-accent-ink)"
              strokeWidth={2}
              fill="url(#signupsFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
