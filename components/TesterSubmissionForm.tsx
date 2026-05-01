"use client"

import { useState } from "react"
import { submitTestResult } from "@/actions/submissions"
import { Upload, Loader2, CheckCircle, Image as ImageIcon } from "lucide-react"
import { Textarea } from "@/components/ui/Textarea"
import { Button } from "@/components/ui/Button"

export default function TesterSubmissionForm({ missionId }: { missionId: string }) {
  const [isUploading, setIsUploading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

  if (isSuccess) {
    return (
      <div className="text-center p-12 bg-iron/50 rounded-2xl border border-transparent flex flex-col items-center">
        <div className="w-16 h-16 bg-chalk text-obsidian rounded-full flex items-center justify-center mb-6">
          <CheckCircle size={32} />
        </div>
        <h3 className="font-syne text-2xl font-bold tracking-tight text-chalk mb-2">Test Confirmed</h3>
        <p className="font-mono text-sm text-ash max-w-sm mx-auto leading-relaxed">
          Your evidence has been logged into the system and parsed by the verification unit.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setIsUploading(true)
        try {
          const formData = new FormData(e.currentTarget)
          const result = await submitTestResult(formData)
          if (result?.success) setIsSuccess(true)
        } catch (error: any) {
          alert("Submission failed: " + error.message)
        } finally {
          setIsUploading(false)
        }
      }} 
      className="space-y-8"
    >
      <input type="hidden" name="missionId" value={missionId} />

      {/* Image Upload Area */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-mono font-semibold uppercase tracking-wider text-ash ml-1">Submit Screenshot</label>
        <div className="relative group cursor-pointer">
          <input
            type="file"
            name="screenshot"
            accept="image/*"
            required
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setSelectedFileName(e.target.files[0].name)
              } else {
                setSelectedFileName(null)
              }
            }}
          />
          <div className="border border-dashed border-iron bg-iron/20 rounded-2xl p-12 flex flex-col items-center justify-center group-hover:border-chalk group-hover:bg-iron/50 transition-all">
            {selectedFileName ? (
              <>
                <div className="w-12 h-12 bg-chalk text-obsidian rounded-xl flex items-center justify-center mb-4">
                  <ImageIcon size={24} />
                </div>
                <p className="font-mono text-sm text-chalk font-medium mb-1">{selectedFileName}</p>
                <p className="font-mono text-xs text-ash mt-1 tracking-wide">Tap to swap file payload</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-iron text-ash rounded-xl flex items-center justify-center mb-4 border border-transparent group-hover:text-chalk transition-colors">
                  <Upload size={24} />
                </div>
                <p className="font-mono text-sm font-medium text-chalk mb-1">Click or drag capture here</p>
                <p className="font-mono text-xs text-ash mt-1 tracking-wide">JPEG/PNG max 5MB</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* User Note */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-mono font-semibold uppercase tracking-wider text-ash ml-1">Observational Notes</label>
        <Textarea
          name="comment"
          required
          placeholder="Log your experience. Report any anomalies encountered..."
          className="min-h-[128px]"
        />
      </div>

      <Button
        type="submit"
        disabled={isUploading}
        variant="primary"
        className="w-full mt-4"
      >
        {isUploading ? (
          <>
            <div className="h-4 w-4 border-2 border-obsidian border-t-transparent animate-spin rounded-full cursor-not-allowed mr-2" />
            Parsing Submission...
          </>
        ) : (
          "Submit Test Result"
        )}
      </Button>
    </form>
  )
}