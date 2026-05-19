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
    <div className="bg-graphite border border-iron rounded-[12px] p-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
      <h3 className="font-syne font-bold text-[16px] text-chalk mb-1">{title}</h3>
      <p className="font-mono text-[12px] text-ash mb-4">{subtitle}</p>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="signupsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8FF47" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#E8FF47" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#2C2C35" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#7C7C8A"
              tick={{ fontSize: 11, fontFamily: "var(--font-dm-mono)" }}
              tickLine={false}
              axisLine={{ stroke: "#2C2C35" }}
              tickFormatter={(v: string) => v.slice(5)}
              minTickGap={24}
            />
            <YAxis
              stroke="#7C7C8A"
              tick={{ fontSize: 11, fontFamily: "var(--font-dm-mono)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={32}
            />
            <Tooltip
              cursor={{ stroke: "#E8FF47", strokeOpacity: 0.2 }}
              contentStyle={{
                background: "#15151A",
                border: "1px solid #2C2C35",
                borderRadius: 8,
                fontFamily: "var(--font-dm-mono)",
                fontSize: 12,
                color: "#F4F4F5",
              }}
              labelStyle={{ color: "#7C7C8A", marginBottom: 4 }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#E8FF47"
              strokeWidth={2}
              fill="url(#signupsFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
