import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export default async function ProjectMissionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from("projects")
    .select(`
      id, name, description, app_url,
      missions (id, title, is_active, created_at, test_results (count))
    `)
    .eq("id", projectId)
    .single()

  if (!project) notFound()

  const missions = ((project as any).missions ?? []).filter(
    (m: any) => m.is_active !== false,
  )

  return (
    <div className="max-w-[800px] mx-auto px-6 md:px-8 py-10">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-mono text-[13px] text-ash mb-8">
        <Link href="/explore" className="hover:text-chalk transition-colors duration-150">
          Explore
        </Link>
        <span>/</span>
        <span className="text-chalk truncate">{project.name}</span>
      </div>

      {/* Project card */}
      <div
        className="bg-graphite border border-iron rounded-[12px] p-6 mb-10"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
      >
        <h1 className="font-syne font-bold text-[28px] leading-[34px] text-chalk mb-1">
          {project.name}
        </h1>
        {project.app_url && (
          <a
            href={project.app_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[13px] text-sky hover:underline mb-3 block"
          >
            {project.app_url.replace(/^https?:\/\//, "")}
          </a>
        )}
        {project.description && (
          <p className="font-mono text-[14px] text-ash leading-5 mt-2">
            {project.description}
          </p>
        )}
      </div>

      {/* Missions header */}
      <div className="mb-5">
        <h2 className="font-syne font-bold text-[20px] text-chalk">Missions</h2>
        <p className="font-mono text-[13px] text-ash mt-0.5">
          {missions.length} available to test
        </p>
      </div>

      {/* Mission list */}
      <div className="flex flex-col gap-4">
        {missions.map((mission: any, i: number) => {
          const num = (i + 1).toString().padStart(2, "0")
          const feedbackCount = mission.test_results?.[0]?.count ?? 0
          return (
            <div
              key={mission.id}
              className="relative overflow-hidden bg-graphite border border-iron rounded-[12px] px-6 py-5 flex items-center justify-between gap-4 hover:border-voltage/30 transition-colors duration-150"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
            >
              {/* Watermark number */}
              <span
                className="absolute right-4 top-1/2 -translate-y-1/2 font-syne font-bold select-none pointer-events-none leading-none text-voltage"
                style={{ fontSize: 96, opacity: 0.08 }}
                aria-hidden="true"
              >
                {num}
              </span>

              <div className="flex-1 min-w-0 relative z-10">
                <span className="font-syne font-bold text-voltage text-[14px] leading-none">
                  {num}
                </span>
                <p className="font-syne font-bold text-[18px] text-chalk leading-6 truncate mt-1">
                  {mission.title}
                </p>
                {feedbackCount > 0 && (
                  <p className="font-mono text-[12px] text-ash mt-1">
                    {feedbackCount} feedback{feedbackCount !== 1 ? "s" : ""}
                  </p>
                )}
              </div>

              <Link
                href={`/mission/${mission.id}`}
                className="shrink-0 relative z-10 flex items-center gap-1.5 font-mono text-[13px] font-medium text-ash hover:text-voltage transition-colors duration-150"
              >
                Start <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )
        })}
      </div>

    </div>
  )
}
