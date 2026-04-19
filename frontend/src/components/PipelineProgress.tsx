import { useEffect, useState } from "react";
import type { StepEvent } from "../App";

const STEPS = [
  { key: "ingest",           label: "Ingest",    icon: "📥", desc: "Normalize scanner data" },
  { key: "dedup",            label: "Dedup",     icon: "🔄", desc: "Remove duplicates" },
  { key: "cluster",          label: "Cluster",   icon: "🧩", desc: "Group by attack surface" },
  { key: "synthesize",       label: "Synthesize", icon: "⚡", desc: "Build attack chains" },
  { key: "mitre_prioritize", label: "MITRE Map", icon: "🎯", desc: "Score & rank" },
  { key: "report",           label: "Report",    icon: "📋", desc: "Generate report" },
];

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-50 border-red-200 text-red-700",
  high:     "bg-orange-50 border-orange-200 text-orange-700",
  medium:   "bg-yellow-50 border-yellow-200 text-yellow-700",
  low:      "bg-blue-50 border-blue-200 text-blue-700",
};
const SEV_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-400",
  medium:   "bg-yellow-400",
  low:      "bg-blue-400",
};

function SynthChainCard({ event, isLatest }: { event: StepEvent; isLatest: boolean }) {
  const [displayed, setDisplayed] = useState("");
  const text = event.narrative_preview ?? "";
  const sev = event.severity ?? "high";

  useEffect(() => {
    if (!text) return;
    setDisplayed("");
    let i = 0;
    const speed = 8; // ms per char
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
  }, [text]);

  const sevClass = SEV_COLORS[sev] ?? SEV_COLORS.high;
  const dotClass = SEV_DOT[sev] ?? SEV_DOT.high;

  return (
    <div className={`rounded-xl border p-3 ${sevClass} transition-all duration-300`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass} ${isLatest ? "animate-pulse" : ""}`} />
        <span className="text-[11px] font-bold tracking-wide">{event.name}</span>
        <span className={`ml-auto text-[9px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded border ${sevClass}`}>
          {sev}
        </span>
      </div>
      <p className="text-[11px] leading-relaxed opacity-80 line-clamp-3">
        {displayed}
        {isLatest && displayed.length < text.length && (
          <span className="inline-block w-1.5 h-3.5 bg-current ml-0.5 opacity-70 animate-pulse" />
        )}
      </p>
    </div>
  );
}

type Props = { steps: StepEvent[]; running: boolean };

export default function PipelineProgress({ steps, running }: Props) {
  const completedSteps = new Set(
    steps.filter((e) => e.type === "step_complete").map((e) => e.step)
  );
  const activeStep = steps.findLast((e) => e.type === "step_start")?.step;
  const synthChains = steps.filter((e) => e.type === "chain_preview");

  const summaries: Record<string, string> = {};
  for (const e of steps) {
    if (e.type === "step_complete" && e.step && e.result_summary) {
      summaries[e.step] = e.result_summary;
    }
  }

  const completedCount = completedSteps.size;
  const progress = (completedCount / STEPS.length) * 100;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
      {/* Header with progress bar */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-blue-50 border border-blue-200 flex items-center justify-center">
            {running ? (
              <svg className="w-3 h-3 text-blue-600 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <circle cx="12" cy="12" r="10" strokeOpacity={0.3} />
                <path d="M12 2a10 10 0 019.95 9" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            )}
          </div>
          <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-widest">Pipeline</h2>
        </div>
        <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-blue-500 to-green-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-600 font-mono w-10 text-right">
          {completedCount}/{STEPS.length}
        </span>
      </div>

      {/* Step nodes */}
      <div className="flex items-start gap-0">
        {STEPS.map((s, i) => {
          const done = completedSteps.has(s.key);
          const active = activeStep === s.key;
          const summary = summaries[s.key];

          return (
            <div key={s.key} className="flex items-start flex-1 min-w-0">
              {/* Node */}
              <div className="flex flex-col items-center flex-1 min-w-0">
                {/* Circle */}
                <div className={`
                  relative w-11 h-11 rounded-xl flex items-center justify-center text-base
                  transition-all duration-500 border
                  ${done
                    ? "bg-green-50 border-green-200 shadow-sm"
                    : active
                    ? "bg-blue-50 border-blue-200 shadow-sm"
                    : "bg-gray-100 border-gray-200"
                  }
                `}>
                  {done ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <span className={active ? "" : "opacity-40"}>{s.icon}</span>
                  )}
                  {/* Active pulse ring */}
                  {active && (
                    <div className="absolute inset-0 rounded-xl border-2 border-blue-300 animate-ping" />
                  )}
                </div>

                {/* Label */}
                <span className={`mt-2 text-[10px] font-semibold uppercase tracking-wider text-center
                  ${done ? "text-green-600" : active ? "text-blue-600" : "text-gray-500"}`}>
                  {s.label}
                </span>

                {/* Description */}
                <span className="text-[9px] text-gray-500 text-center mt-0.5 hidden sm:block">
                  {s.desc}
                </span>

                {/* Summary */}
                {summary && (
                  <span className="text-[9px] text-green-600 text-center mt-1 font-mono">
                    {summary}
                  </span>
                )}
              </div>

              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div className="flex items-center pt-5 px-0.5">
                  <div className={`w-6 sm:w-10 h-0.5 rounded-full transition-all duration-700
                    ${done ? "bg-green-400" :
                      active ? "bg-blue-300" : "bg-gray-300"
                    }`} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live synthesis + MITRE section — hidden once mitre_prioritize is done */}
      {synthChains.length > 0 && !completedSteps.has("mitre_prioritize") && (
        <div className="mt-2 space-y-3">
          {/* Synthesis cards */}
          {(activeStep === "synthesize" || completedSteps.has("synthesize")) && (
            <>
              <div className="flex items-center gap-2">
                {running && activeStep === "synthesize" ? (
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{animationDelay:"0ms"}} />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{animationDelay:"150ms"}} />
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{animationDelay:"300ms"}} />
                  </span>
                ) : (
                  <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
                  {running && activeStep === "synthesize" ? "Building attack chains…" : `${synthChains.length} attack chains identified`}
                </span>
              </div>
              <div className="space-y-2">
                {synthChains.map((e, idx) => (
                  <SynthChainCard key={e.chain_id ?? idx} event={e} isLatest={idx === synthChains.length - 1 && activeStep === "synthesize"} />
                ))}
              </div>
            </>
          )}

          {/* MITRE mapping animation — shown once synthesize is done */}
          {completedSteps.has("synthesize") && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-50 border border-purple-100">
              <div className="mt-0.5 shrink-0">
                {completedSteps.has("mitre_prioritize") ? (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-purple-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-[11px] font-semibold text-purple-800">Mapping to MITRE ATT&CK</p>
                <p className="text-[10px] text-purple-600 mt-0.5">
                  Scoring each chain against known adversary techniques, assigning tactics and CVE correlations…
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step log */}
      {Object.entries(summaries).length > 0 && (
        <div className="border-t border-gray-200 pt-3 space-y-1">
          {STEPS.filter((s) => summaries[s.key]).map((s) => (
            <div key={s.key} className="flex gap-3 text-[10px] text-gray-500">
              <span className="text-blue-600 w-20 shrink-0 font-semibold">[{s.label}]</span>
              <span>{summaries[s.key]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
