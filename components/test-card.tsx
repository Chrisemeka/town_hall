"use client";

import { MessageSquare, Clock, X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export function TestResultCard({ data }: { data: any }) {
  const missionTitle = data.missions?.title || "General Protocol";
  const [isOpen, setIsOpen] = useState(false);
  const [isInsightOpen, setIsInsightOpen] = useState(false);

  return (
    <div className="group bg-surface rounded-2xl overflow-hidden border border-outline-variant hover:border-outline transition-all shadow-sm flex flex-col">
      <div className="aspect-video relative bg-surface-variant overflow-hidden cursor-pointer border-b border-outline-variant" onClick={() => setIsOpen(true)}>
        <img 
          src={data.screenshot_url} 
          alt="Telemetry Evidence" 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        
        <div className={`absolute top-4 right-4 px-3 py-1.5 rounded text-xs font-semibold tracking-wide uppercase shadow-sm border backdrop-blur-md
          ${data.ai_sentiment === 'NEGATIVE' || data.ai_sentiment === 'FRUSTRATED' 
            ? 'bg-error-container/80 text-error border-error/20' 
            : 'bg-surface/80 text-on-surface border-outline-variant'}`}>
          {data.ai_sentiment}
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium tracking-tight text-on-surface truncate pr-4">
              {missionTitle}
            </h4>
            <div className="flex items-center gap-2 text-xs font-medium text-secondary shrink-0 bg-surface-variant px-2 py-1 rounded border border-outline-variant">
              <Clock size={12} />
              {new Date(data.created_at).toLocaleDateString()}
            </div>
          </div>

          <div className="flex gap-3 mb-4 bg-surface-variant/50 p-4 rounded-xl border border-outline-variant/50">
            <MessageSquare size={16} className="text-secondary shrink-0 mt-0.5" />
            <p className="text-sm text-secondary italic line-clamp-3 leading-relaxed">
              "{data.tester_comment}"
            </p>
          </div>
        </div>

        {data.ai_summary && (
          <div className="mt-4 pt-4 border-t border-outline-variant/50">
            <button 
              onClick={() => setIsInsightOpen(!isInsightOpen)}
              className="w-full flex items-center justify-between group/insight outline-none"
            >
              <p className="text-xs font-semibold uppercase tracking-wider transition-colors text-on-surface">
                System Insight
              </p>
              <div className="w-6 h-6 rounded flex items-center justify-center border border-outline-variant bg-surface-variant group-hover/insight:bg-on-surface group-hover/insight:text-surface transition-colors">
                {isInsightOpen ? (
                  <ChevronUp size={14} className="text-current" />
                ) : (
                  <ChevronDown size={14} className="text-current text-secondary" />
                )}
              </div>
            </button>
            
            {isInsightOpen && (
              <div className="text-sm text-secondary leading-relaxed whitespace-pre-wrap mt-4 animate-in fade-in slide-in-from-top-1 bg-surface-variant p-4 rounded-xl border border-outline-variant">
                {data.ai_summary}
              </div>
            )}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/95 backdrop-blur-sm p-4" onClick={() => setIsOpen(false)}>
          <button 
            className="absolute top-8 right-8 w-12 h-12 bg-surface hover:bg-surface-variant border border-outline-variant rounded-full text-on-surface flex items-center justify-center transition-colors shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          >
            <X size={20} />
          </button>
          <div className="bg-surface border border-outline-variant shadow-2xl rounded-2xl p-2 max-w-5xl">
            <img 
              src={data.screenshot_url} 
              alt="Full Telemetry Evidence" 
              className="w-full max-h-[85vh] object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}