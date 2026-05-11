import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { AppShell } from "@/components/layout/AppShell"

export default function NotFound() {
  return (
    <AppShell>
      <div
        className="relative flex flex-col items-center justify-center px-6 text-center"
        style={{ height: "calc(100vh - 56px)", overflow: "hidden" }}
      >
        {/* Watermark */}
        <span
          className="absolute font-syne font-bold text-voltage select-none pointer-events-none leading-none"
          style={{ fontSize: 320, opacity: 0.04 }}
          aria-hidden="true"
        >
          404
        </span>

        <div className="relative z-10 flex flex-col items-center">
          <p className="font-mono text-[12px] font-medium text-voltage uppercase tracking-[1px] mb-4">
            Error 404
          </p>
          <h1 className="font-syne font-bold text-[40px] leading-[46px] tracking-[-0.5px] text-chalk mb-3">
            Page not found.
          </h1>
          <p className="font-mono text-[14px] text-ash mb-8 max-w-[340px] leading-5">
            The page you're looking for doesn't exist or may have been moved.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/dashboard"
              className="h-10 px-5 bg-voltage text-obsidian rounded-[8px] font-mono font-medium text-[14px] hover:bg-voltage-dark transition-colors duration-150 flex items-center gap-1.5"
            >
              My Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/explore"
              className="h-10 px-5 border border-iron text-chalk rounded-[8px] font-mono text-[14px] hover:border-ash transition-colors duration-150 flex items-center justify-center"
            >
              Explore Projects
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
