"use client"

import { createMission } from "@/actions/missions"
import { useFormStatus } from "react-dom"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Button } from "@/components/ui/Button"

export default function AddMissionForm({ projectId }: { projectId: string }) {
  return (
    <Card className="relative overflow-hidden">
      {/* Subtle depth */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-voltage opacity-[0.03] rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      
      <CardHeader>
        <CardTitle>New Test Mission</CardTitle>
      </CardHeader>
      
      <CardContent>
        <form action={createMission} className="flex flex-col gap-6">
          {/* Hidden input to pass the project ID */}
          <input type="hidden" name="projectId" value={projectId} />

          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono font-medium text-ash uppercase tracking-wider ml-1">Mission Title</label>
            <Input
              name="title"
              required
              placeholder="e.g., Test the Onboarding flow"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono font-medium text-ash uppercase tracking-wider ml-1">Execution Parameters</label>
            <Textarea
              name="task_description"
              required
              placeholder="Tell users exactly what to do step-by-step..."
              className="min-h-[120px]"
            />
          </div>

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      variant="primary"
      className="mt-2 w-full"
    >
      {pending ? "Initializing Protocol..." : "Launch Mission"}
    </Button>
  )
}