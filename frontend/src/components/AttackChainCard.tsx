import { useState } from "react";
import type { Chain } from "../App";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-300",
  high:     "bg-orange-50 text-orange-700 border-orange-300",
  medium:   "bg-yellow-50 text-yellow-700 border-yellow-300",
  low:      "bg-blue-50 text-blue-700 border-blue-300",
};

const SEV_ACCENT: Record<string, string> = {
  critical: "bg-red-600",
  high:     "bg-orange-500",
  medium:   "bg-yellow-400",
  low:      "bg-blue-400",
};

const SEV_BADGE: Record<string, string> = {
  critical: "bg-red-600 text-white border-red-700",
  high:     "bg-orange-500 text-white border-orange-600",
  medium:   "bg-yellow-400 text-yellow-900 border-yellow-500",
  low:      "bg-blue-400 text-white border-blue-500",
};

const SEV_BORDER: Record<string, string> = {
  critical: "border-red-300",
  high:     "border-orange-300",
  medium:   "border-yellow-300",
  low:      "border-blue-300",
};

const TACTIC_COLORS: Record<string, string> = {
  "initial-access":       "bg-purple-50 text-purple-700 border-purple-200",
  "execution":            "bg-red-50 text-red-700 border-red-200",
  "credential-access":    "bg-orange-50 text-orange-700 border-orange-200",
  "defense-evasion":      "bg-teal-50 text-teal-700 border-teal-200",
  "persistence":          "bg-indigo-50 text-indigo-700 border-indigo-200",
  "privilege-escalation": "bg-pink-50 text-pink-700 border-pink-200",
  "impact":               "bg-rose-50 text-rose-700 border-rose-200",
  "discovery":            "bg-cyan-50 text-cyan-700 border-cyan-200",
  "collection":           "bg-green-50 text-green-700 border-green-200",
  "exfiltration":         "bg-amber-50 text-amber-700 border-amber-200",
  "command-and-control":  "bg-violet-50 text-violet-700 border-violet-200",
  "lateral-movement":     "bg-blue-50 text-blue-700 border-blue-200",
};

export default function AttackChainCard({ chain }: { chain: Chain }) {
  const [expanded, setExpanded] = useState(false);
  const [fixSuggestion, setFixSuggestion] = useState<string | null>(null);
  const [fixLoading, setFixLoading] = useState(false);

  const sevClass   = SEV_COLORS[chain.severity]  ?? "bg-gray-100 text-gray-700 border-gray-300";
  const accentClass = SEV_ACCENT[chain.severity] ?? "bg-gray-400";
  const badgeClass  = SEV_BADGE[chain.severity]  ?? "bg-gray-500 text-white border-gray-600";
  const borderClass = SEV_BORDER[chain.severity] ?? "border-gray-300";

  // Parse narrative steps for chain visualization
  const steps = chain.narrative
    ? chain.narrative.trim().split("\n").filter((l) => l.trim())
    : [];

  const isCritical = chain.severity === "critical";

  async function handleSuggestFix() {
    setFixLoading(true);
    setFixSuggestion(null);
    try {
      const res = await fetch(`${API}/suggest-fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain_name: chain.name,
          severity: chain.severity,
          narrative: chain.narrative,
          business_impact: chain.business_impact,
          locations: chain.locations,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFixSuggestion(data.suggestion ?? "No suggestion returned.");
    } catch (e) {
      setFixSuggestion(`Error fetching suggestion: ${e}`);
    } finally {
      setFixLoading(false);
    }
  }

  return (
    <div className={`bg-white rounded-2xl overflow-hidden transition-all duration-300
      ${isCritical
        ? "border-2 border-red-300 shadow-lg shadow-red-200/70"
        : "border border-gray-200 shadow-sm hover:shadow-md"}`}>

      {/* Header row */}
      <div
        className="flex items-start gap-4 px-5 pt-4 pb-4 cursor-pointer hover:bg-gray-50/60 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Priority + severity badge stacked */}
        <div className="shrink-0 flex flex-col items-center gap-1.5">
          <div className={`w-11 h-11 rounded-xl border-2 flex flex-col items-center justify-center font-mono ${sevClass}`}>
            <span className="text-[9px] font-semibold uppercase tracking-widest opacity-60">#</span>
            <span className="text-lg font-black leading-none">{chain.fix_priority}</span>
          </div>
          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${badgeClass} tracking-wider`}>
            {chain.severity.slice(0, 4)}
          </span>
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-bold text-gray-900 text-sm">{chain.name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-semibold
              ${chain.confidence >= 0.8 ? "bg-green-50 text-green-700 border-green-300"
                : chain.confidence >= 0.6 ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                : "bg-gray-100 text-gray-600 border-gray-300"}`}>
              {Math.round(chain.confidence * 100)}% conf
            </span>
          </div>

          {/* Chain step preview — numbered dots, no text truncation */}
          {steps.length > 0 && (
            <div className="mt-3 flex items-center gap-0">
              {steps.map((_, i) => {
                const isLast = i === steps.length - 1;
                return (
                  <div key={i} className="flex items-center shrink-0">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                      text-[9px] font-black shrink-0
                      ${isLast ? badgeClass : "bg-white border-gray-300 text-gray-400"}`}>
                      {i + 1}
                    </div>
                    {!isLast && <div className={`w-5 h-px ${accentClass} opacity-50 shrink-0`} />}
                  </div>
                );
              })}
              <span className="ml-2 text-[9px] text-gray-400 font-mono">{steps.length}-step path</span>
            </div>
          )}

          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <span className="text-[10px] text-gray-400 font-mono">
              {chain.finding_ids?.length ?? 0} findings · {chain.clusters_spanned?.length ?? 0} surfaces
            </span>
            {chain.mitre_techniques?.slice(0, 3).map((t) => (
              <span
                key={t.id}
                title={`${t.name} — ${t.tactic}`}
                className={`text-[10px] px-2 py-0.5 rounded border font-mono transition-all hover:scale-105
                  ${TACTIC_COLORS[t.tactic] ?? "bg-gray-100 text-gray-600 border-gray-300"}`}
              >
                {t.id}
              </span>
            ))}
            {(chain.mitre_techniques?.length ?? 0) > 3 && (
              <span className="text-[10px] text-gray-400">
                +{chain.mitre_techniques.length - 3}
              </span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <div className={`w-7 h-7 rounded-lg bg-gray-100 border border-gray-200
          flex items-center justify-center transition-transform duration-300 shrink-0
          ${expanded ? "rotate-180" : ""}`}>
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t-2 border-dashed border-gray-200 bg-gray-50 p-5 space-y-5 text-sm">

          {/* Chain steps — vertical chain visualization */}
          {steps.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-3 font-semibold flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 016.364 6.364l-4.5 4.5a4.5 4.5 0 01-7.244-1.242" />
                </svg>
                Attack Chain
              </div>
              <div className="flex flex-col gap-0">
                {steps.map((step, i) => {
                  const isLast = i === steps.length - 1;
                  const text = step.replace(/^\d+\.\s*/, "");
                  return (
                    <div key={i} className="flex gap-3">
                      {/* Left track */}
                      <div className="flex flex-col items-center w-6 shrink-0">
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[9px] font-black shrink-0
                          ${isLast ? badgeClass : "bg-white border-gray-300 text-gray-500"}`}>
                          {i + 1}
                        </div>
                        {!isLast && (
                          <div className="flex flex-col items-center gap-0.5 py-1">
                            <div className={`w-0.5 h-2 ${accentClass} opacity-40`} />
                            <div className={`w-2.5 h-2.5 rounded-sm border ${accentClass} opacity-20 rotate-45`} />
                            <div className={`w-0.5 h-2 ${accentClass} opacity-40`} />
                          </div>
                        )}
                      </div>
                      {/* Step content */}
                      <div className={`flex-1 pb-3 text-xs leading-relaxed
                        ${isLast ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                        {text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Business impact + Blast radius */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-2 font-semibold flex items-center gap-1.5">
                <svg className="w-3 h-3 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
                Business Impact
              </div>
              <p className="text-gray-600 text-xs leading-relaxed">{chain.business_impact}</p>
            </div>
            {chain.blast_radius_notes && (
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-2 font-semibold flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" />
                  </svg>
                  Blast Radius
                </div>
                <p className="text-gray-600 text-xs leading-relaxed">{chain.blast_radius_notes}</p>
              </div>
            )}
          </div>

          {/* Where is the Issue? */}
          {chain.locations && chain.locations.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-3 font-semibold flex items-center gap-1.5">
                <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                Where is the Issue?
              </div>
              <div className="flex flex-col gap-1.5">
                {chain.locations.map((loc) => (
                  <span key={loc} className="font-mono text-[11px] text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 break-all">
                    {loc}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Want to Fix? */}
          <div className="flex flex-col gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); handleSuggestFix(); }}
              disabled={fixLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold
                hover:bg-blue-700 disabled:opacity-50 transition-colors w-fit shadow-sm"
            >
              {fixLoading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating fix...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Want to Fix?
                </>
              )}
            </button>
            {fixSuggestion && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                {fixSuggestion
                  .split(/(?=\d+\.\s)/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((item, i) => {
                    const match = item.match(/^(\d+)\.\s+(.*)/s);
                    if (match) {
                      return (
                        <div key={i} className="flex gap-2.5 text-xs text-gray-700 leading-relaxed">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold mt-0.5">
                            {match[1]}
                          </span>
                          <p>{match[2]}</p>
                        </div>
                      );
                    }
                    return <p key={i} className="text-xs text-gray-600 italic leading-relaxed">{item}</p>;
                  })}
              </div>
            )}
          </div>

          {/* MITRE techniques */}
          {chain.mitre_techniques?.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-3 font-semibold flex items-center gap-1.5">
                <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                MITRE ATT&CK
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {chain.mitre_techniques.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 text-xs px-3 py-2
                    rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-colors">
                    <span className="font-mono text-blue-600 font-bold w-16 shrink-0">{t.id}</span>
                    <span className="text-gray-700 flex-1 truncate">{t.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border
                      ${TACTIC_COLORS[t.tactic] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {t.tactic}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Surfaces */}
          {chain.clusters_spanned?.length > 0 && (
            <div className="flex gap-2 flex-wrap pt-2 border-t border-gray-200">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider py-0.5">Surfaces:</span>
              {chain.clusters_spanned.map((s) => (
                <span key={s} className="text-[10px] px-2.5 py-1 bg-gray-100 border border-gray-200
                                          rounded-lg text-gray-600 font-mono">
                  {s.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
