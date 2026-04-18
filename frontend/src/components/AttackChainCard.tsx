import { useState } from "react";
import type { Chain } from "../App";

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-900 text-red-300 border-red-700",
  high:     "bg-orange-900 text-orange-300 border-orange-700",
  medium:   "bg-yellow-900 text-yellow-300 border-yellow-700",
  low:      "bg-blue-900 text-blue-300 border-blue-700",
};

const TACTIC_COLORS: Record<string, string> = {
  "initial-access":       "bg-purple-900 text-purple-300",
  "execution":            "bg-red-900 text-red-300",
  "credential-access":    "bg-orange-900 text-orange-300",
  "defense-evasion":      "bg-teal-900 text-teal-300",
  "persistence":          "bg-indigo-900 text-indigo-300",
  "privilege-escalation": "bg-pink-900 text-pink-300",
  "impact":               "bg-rose-900 text-rose-300",
  "discovery":            "bg-cyan-900 text-cyan-300",
  "collection":           "bg-green-900 text-green-300",
  "exfiltration":         "bg-amber-900 text-amber-300",
  "command-and-control":  "bg-violet-900 text-violet-300",
};

export default function AttackChainCard({ chain }: { chain: Chain }) {
  const [expanded, setExpanded] = useState(false);
  const sevClass = SEV_COLORS[chain.severity] ?? "bg-gray-800 text-gray-300 border-gray-600";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-start gap-4 p-5 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Priority badge */}
        <div className="shrink-0 w-9 h-9 rounded-lg bg-gray-800 border border-gray-700
                        flex items-center justify-center text-sm font-bold text-emerald-400">
          #{chain.fix_priority}
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-100">{chain.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sevClass}`}>
              {chain.severity}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            {/* Confidence */}
            <ConfidenceBar value={chain.confidence} />
            {/* MITRE badges */}
            {chain.mitre_techniques?.map((t) => (
              <span
                key={t.id}
                title={`${t.name} — ${t.tactic}`}
                className={`text-xs px-2 py-0.5 rounded font-mono ${TACTIC_COLORS[t.tactic] ?? "bg-gray-700 text-gray-300"}`}
              >
                {t.id}
              </span>
            ))}
          </div>
        </div>

        {/* Expand toggle */}
        <span className="text-gray-600 text-xs mt-1">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-800 p-5 space-y-4 text-sm">
          {/* Narrative */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">
              Attacker Narrative
            </div>
            <pre className="whitespace-pre-wrap text-gray-200 text-xs leading-relaxed font-mono
                             bg-gray-950 rounded-lg p-3 border border-gray-800">
              {chain.narrative}
            </pre>
          </div>

          {/* Business impact */}
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">
              Business Impact
            </div>
            <p className="text-gray-300 text-sm">{chain.business_impact}</p>
          </div>

          {/* Blast radius */}
          {chain.blast_radius_notes && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">
                Blast Radius
              </div>
              <p className="text-gray-400 text-sm">{chain.blast_radius_notes}</p>
            </div>
          )}

          {/* MITRE techniques detail */}
          {chain.mitre_techniques?.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-widest mb-2">
                MITRE ATT&amp;CK
              </div>
              <div className="flex flex-col gap-1">
                {chain.mitre_techniques.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-emerald-400 w-16">{t.id}</span>
                    <span className="text-gray-300">{t.name}</span>
                    <span className="text-gray-600">·</span>
                    <span className="text-gray-500">{t.tactic}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attack surfaces */}
          {chain.clusters_spanned?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {chain.clusters_spanned.map((s) => (
                <span key={s} className="text-xs px-2 py-0.5 bg-gray-800 border border-gray-700
                                          rounded text-gray-400">
                  {s.replace("_", " ")}
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
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <span>conf</span>
      <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span>{pct}%</span>
    </div>
  );
}
