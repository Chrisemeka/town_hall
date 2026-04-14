"use client"

import { useState } from "react"
import { submitTestResult } from "@/actions/submissions"
import { Upload, Loader2, CheckCircle, Image as ImageIcon } from "lucide-react"

export default function TesterSubmissionForm({ missionId }: { missionId: string }) {
  const [isUploading, setIsUploading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)

  if (isSuccess) {
    return (
      <div className="text-center p-12 bg-surface-variant rounded-2xl border border-outline-variant flex flex-col items-center">
        <div className="w-16 h-16 bg-on-surface text-surface rounded-full flex items-center justify-center mb-6">
          <CheckCircle size={32} />
        </div>
        <h3 className="text-2xl font-medium tracking-tight text-on-surface mb-2">Test Confirmed</h3>
        <p className="text-sm text-secondary max-w-sm mx-auto leading-relaxed">
          Your evidence has been logged into the system and parsed by the verification unit.
        </p>
      </div>
    )
  }

  return (
    <form
      action={async (formData) => {
        setIsUploading(true)
        try {
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
        <label className="text-xs font-semibold uppercase tracking-wider text-secondary ml-1">Submit Screenshot</label>
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
          <div className="border border-dashed border-outline-variant bg-surface-variant rounded-2xl p-12 flex flex-col items-center justify-center group-hover:border-outline group-hover:bg-surface-variant/50 transition-all">
            {selectedFileName ? (
              <>
                <div className="w-12 h-12 bg-on-surface text-surface rounded-xl flex items-center justify-center mb-4">
                  <ImageIcon size={24} />
                </div>
                <p className="text-sm text-on-surface font-medium mb-1">{selectedFileName}</p>
                <p className="text-xs text-secondary mt-1 tracking-wide">Tap to swap file payload</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-surface text-secondary rounded-xl flex items-center justify-center mb-4 border border-outline-variant group-hover:text-on-surface group-hover:border-outline transition-colors">
                  <Upload size={24} />
                </div>
                <p className="text-sm font-medium text-on-surface mb-1">Click or drag capture here</p>
                <p className="text-xs text-secondary mt-1 tracking-wide">JPEG/PNG max 5MB</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* User Note */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-secondary ml-1">Observational Notes</label>
        <textarea
          name="comment"
          required
          placeholder="Log your experience. Report any anomalies encountered..."
          className="min-h-32 p-4 rounded-xl bg-surface-variant border border-outline-variant focus:border-outline focus:ring-1 focus:ring-outline outline-none text-sm text-on-surface transition-all placeholder:text-secondary/50 resize-y"
        />
      </div>

      <button
        type="submit"
        disabled={isUploading}
        className="w-full h-14 bg-on-surface text-surface rounded-full font-medium text-sm hover:bg-white/90 shadow-sm transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
      >
        {isUploading ? (
          <>
            <div className="h-4 w-4 border-2 border-surface border-t-transparent animate-spin rounded-full" />
            Parsing Submission...
          </>
        ) : (
          "Submit Test Result"
        )}
      </button>
    </form>
  )
}