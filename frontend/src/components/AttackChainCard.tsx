import { useState } from "react";
import type { Chain } from "../App";

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-300",
  high:     "bg-orange-50 text-orange-700 border-orange-300",
  medium:   "bg-yellow-50 text-yellow-700 border-yellow-300",
  low:      "bg-blue-50 text-blue-700 border-blue-300",
};

const SEV_BORDER: Record<string, string> = {
  critical: "border-red-300",
  high:     "border-orange-300",
  medium:   "border-yellow-300",
  low:      "border-blue-300",
};

const SEV_GLOW: Record<string, string> = {
  critical: "hover:shadow-red-200",
  high:     "hover:shadow-orange-200",
  medium:   "hover:shadow-yellow-200",
  low:      "hover:shadow-blue-200",
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
  const sevClass = SEV_COLORS[chain.severity] ?? "bg-gray-100 text-gray-700 border-gray-300";
  const borderClass = SEV_BORDER[chain.severity] ?? "border-gray-300";
  const glowClass = SEV_GLOW[chain.severity] ?? "";

  return (
    <div className={`bg-white rounded-2xl border ${borderClass} shadow-sm
      hover:shadow-md transition-all duration-300 ${glowClass}`}>
      {/* Header row */}
      <div
        className="flex items-start gap-4 p-5 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Priority badge */}
        <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-50 border border-blue-200
                        flex items-center justify-center text-sm font-bold text-blue-600 font-mono">
          #{chain.fix_priority}
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{chain.name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${sevClass}`}>
              {chain.severity}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            {/* Confidence */}
            <ConfidenceBar value={chain.confidence} />
            {/* Findings count */}
            <span className="text-[10px] text-gray-500 font-mono">
              {chain.finding_ids?.length ?? 0} findings
            </span>
            {/* MITRE badges */}
            {chain.mitre_techniques?.slice(0, 4).map((t) => (
              <span
                key={t.id}
                title={`${t.name} — ${t.tactic}`}
                className={`text-[10px] px-2 py-0.5 rounded border font-mono transition-all hover:scale-105
                  ${TACTIC_COLORS[t.tactic] ?? "bg-gray-100 text-gray-600 border-gray-300"}`}
              >
                {t.id}
              </span>
            ))}
            {(chain.mitre_techniques?.length ?? 0) > 4 && (
              <span className="text-[10px] text-gray-500">
                +{chain.mitre_techniques.length - 4} more
              </span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <div className={`w-7 h-7 rounded-lg bg-gray-100 border border-gray-200
          flex items-center justify-center transition-transform duration-300
          ${expanded ? "rotate-180" : ""}`}>
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-5 space-y-5 text-sm">
          {/* Narrative */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 rounded bg-blue-50 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <span className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">
                Attacker Narrative
              </span>
            </div>
            <pre className="whitespace-pre-wrap text-gray-700 text-[11px] leading-relaxed font-mono
                             bg-white rounded-xl p-4 border border-gray-200">
              {chain.narrative}
            </pre>
          </div>

          {/* Business impact + Blast radius side by side */}
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" />
                  </svg>
                  Blast Radius
                </div>
                <p className="text-gray-600 text-xs leading-relaxed">{chain.blast_radius_notes}</p>
              </div>
            )}
          </div>

          {/* MITRE techniques detail */}
          {chain.mitre_techniques?.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-600 uppercase tracking-widest mb-3 font-semibold flex items-center gap-1.5">
                <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                MITRE ATT&CK Techniques
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

          {/* Attack surfaces */}
          {chain.clusters_spanned?.length > 0 && (
            <div className="flex gap-2 flex-wrap pt-2 border-t border-gray-200">
              <span className="text-[10px] text-gray-600 uppercase tracking-wider py-0.5">Surfaces:</span>
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

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
  const textColor = pct >= 80 ? "text-green-600" : pct >= 60 ? "text-yellow-600" : "text-red-600";
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
      <span>conf</span>
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`font-mono font-bold ${textColor}`}>{pct}%</span>
    </div>
  );
}
