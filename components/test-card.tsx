"use client";

import { MessageSquare, Clock, X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function TestResultCard({ data }: { data: any }) {
  const missionTitle = data.missions?.title || "General Protocol";
  const [isOpen, setIsOpen] = useState(false);
  const [isInsightOpen, setIsInsightOpen] = useState(false);

  return (
    <Card className="group flex flex-col overflow-hidden relative">
      <div className="aspect-video relative bg-iron overflow-hidden cursor-pointer border-b border-iron" onClick={() => setIsOpen(true)}>
        <img 
          src={data.screenshot_url} 
          alt="Telemetry Evidence" 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
        />
        
        <div className="absolute top-4 right-4">
          <Badge variant={data.ai_sentiment === 'NEGATIVE' || data.ai_sentiment === 'FRUSTRATED' ? 'negative' : 'positive'}>
            {data.ai_sentiment}
          </Badge>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-syne text-lg font-bold tracking-tight text-chalk truncate pr-4">
              {missionTitle}
            </h4>
            <div className="flex items-center gap-2 text-xs font-mono font-medium text-ash shrink-0 bg-iron px-2 py-1 rounded">
              <Clock size={12} />
              {new Date(data.created_at).toLocaleDateString()}
            </div>
          </div>

          <div className="flex gap-3 mb-4 bg-iron/50 p-4 rounded-xl border border-transparent">
            <MessageSquare size={16} className="text-ash shrink-0 mt-0.5" />
            <p className="font-mono text-sm text-ash italic line-clamp-3 leading-relaxed">
              "{data.tester_comment}"
            </p>
          </div>
        </div>

        {data.ai_summary && (
          <div className="mt-4 pt-4 border-t border-iron flex flex-col relative z-20">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsInsightOpen(!isInsightOpen);
              }}
              className="w-full flex items-center justify-between group/insight outline-none cursor-pointer"
            >
              <p className="font-mono text-xs font-semibold uppercase tracking-wider transition-colors text-chalk">
                System Insight
              </p>
              <div className="w-6 h-6 rounded flex items-center justify-center border border-transparent bg-iron group-hover/insight:bg-chalk group-hover/insight:text-obsidian transition-colors">
                {isInsightOpen ? (
                  <ChevronUp size={14} className="text-current" />
                ) : (
                  <ChevronDown size={14} className="text-current text-ash" />
                )}
              </div>
            </button>
            
            {isInsightOpen && (
              <div className="font-mono text-sm text-ash leading-relaxed whitespace-pre-wrap mt-4 animate-in fade-in slide-in-from-top-1 bg-iron p-4 rounded-xl border border-transparent">
                {data.ai_summary}
              </div>
            )}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian/95 backdrop-blur-sm p-4" onClick={() => setIsOpen(false)}>
          <button 
            className="absolute top-8 right-8 w-12 h-12 bg-iron hover:bg-iron/80 rounded-full text-chalk flex items-center justify-center transition-colors shadow-lg cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          >
            <X size={20} />
          </button>
          <div className="bg-obsidian border border-iron shadow-2xl rounded-2xl p-2 max-w-5xl">
            <img 
              src={data.screenshot_url} 
              alt="Full Telemetry Evidence" 
              className="w-full max-h-[85vh] object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </Card>
  );
}