"use client"

import { useActionState } from "react"
import { createProject } from "@/actions/project"
import { useFormStatus } from "react-dom"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { Button } from "@/components/ui/Button"

export default function CreateProjectForm() {
  const [state, formAction] = useActionState(createProject, null)

  return (
    <Card className="relative overflow-hidden max-w-2xl mx-auto mt-12">
      <div className="absolute top-0 right-0 w-64 h-64 bg-voltage opacity-[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      
      <CardHeader className="text-center pb-8">
        <CardTitle className="text-3xl">Initialize Project</CardTitle>
        <CardDescription>
          Register your application parameters to begin real-user validation.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-8 relative z-10">
          {state?.error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-md text-sm font-mono">
              {state.error}
              </div>
          )}
          
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-xs font-mono font-medium text-ash uppercase tracking-wider ml-1">Project Name</label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="e.g., Flowchart App"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="app_url" className="text-xs font-mono font-medium text-ash uppercase tracking-wider ml-1">Application URL</label>
            <Input
              id="app_url"
              name="app_url"
              type="url"
              placeholder="https://your-app.com"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="description" className="text-xs font-mono font-medium text-ash uppercase tracking-wider ml-1">Project Summary</label>
            <Textarea
              id="description"
              name="description"
              placeholder="Briefly describe what your app does..."
              className="min-h-[128px]"
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
      className="w-full mt-4"
    >
      {pending ? "Initializing..." : "Create Project"}
    </Button>
  )
}