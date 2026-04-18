import type { Chain } from "../App";

const TACTICS_ORDER = [
  "reconnaissance",
  "resource-development",
  "initial-access",
  "execution",
  "persistence",
  "privilege-escalation",
  "defense-evasion",
  "credential-access",
  "discovery",
  "lateral-movement",
  "collection",
  "command-and-control",
  "exfiltration",
  "impact",
] as const;

const TACTIC_LABELS: Record<string, string> = {
  "reconnaissance": "Recon",
  "resource-development": "Rsrc Dev",
  "initial-access": "Initial Access",
  "execution": "Execution",
  "persistence": "Persistence",
  "privilege-escalation": "Priv Esc",
  "defense-evasion": "Def Evasion",
  "credential-access": "Cred Access",
  "discovery": "Discovery",
  "lateral-movement": "Lateral Mvmt",
  "collection": "Collection",
  "command-and-control": "C2",
  "exfiltration": "Exfiltration",
  "impact": "Impact",
};

const TACTIC_GLOW: Record<string, string> = {
  "initial-access": "from-purple-100 to-transparent",
  "execution": "from-red-100 to-transparent",
  "persistence": "from-indigo-100 to-transparent",
  "privilege-escalation": "from-pink-100 to-transparent",
  "defense-evasion": "from-teal-100 to-transparent",
  "credential-access": "from-orange-100 to-transparent",
  "discovery": "from-cyan-100 to-transparent",
  "lateral-movement": "from-blue-100 to-transparent",
  "collection": "from-green-100 to-transparent",
  "command-and-control": "from-violet-100 to-transparent",
  "exfiltration": "from-amber-100 to-transparent",
  "impact": "from-rose-100 to-transparent",
};

type Props = { chains: Chain[] };

export default function MitreHeatmap({ chains }: Props) {
  // Collect all techniques grouped by tactic
  const tacticMap = new Map<string, { id: string; name: string; count: number; maxSev: string }[]>();

  const sevRank: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

  for (const chain of chains) {
    for (const tech of chain.mitre_techniques ?? []) {
      if (!tacticMap.has(tech.tactic)) tacticMap.set(tech.tactic, []);
      const list = tacticMap.get(tech.tactic)!;
      const existing = list.find((t) => t.id === tech.id);
      if (existing) {
        existing.count++;
        if ((sevRank[chain.severity] ?? 0) > (sevRank[existing.maxSev] ?? 0)) {
          existing.maxSev = chain.severity;
        }
      } else {
        list.push({ id: tech.id, name: tech.name, count: 1, maxSev: chain.severity });
      }
    }
  }

  const activeTactics = TACTICS_ORDER.filter((t) => tacticMap.has(t));
  if (activeTactics.length === 0) return null;

  const maxCount = Math.max(
    1,
    ...Array.from(tacticMap.values()).flatMap((l) => l.map((t) => t.count))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-red-50 border border-red-200 flex items-center justify-center">
          <svg className="w-3 h-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-widest">
          MITRE ATT&CK Coverage
        </h3>
        <span className="text-[10px] text-gray-500 ml-auto font-mono">
          {Array.from(tacticMap.values()).flat().length} techniques across {activeTactics.length} tactics
        </span>
      </div>

      {/* Tactic columns */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          {activeTactics.map((tactic, ti) => {
            const techs = tacticMap.get(tactic) ?? [];
            const gradient = TACTIC_GLOW[tactic] ?? "from-gray-500/20 to-transparent";

            return (
              <div
                key={tactic}
                className="w-[130px] shrink-0"
              >
                {/* Tactic header */}
                <div className={`text-[10px] font-bold text-gray-600 uppercase tracking-wider
                  mb-2 px-2 py-1.5 rounded-t-lg bg-gradient-to-b ${gradient} border-b border-gray-200`}>
                  {TACTIC_LABELS[tactic] ?? tactic}
                </div>

                {/* Technique cells */}
                <div className="flex flex-col gap-1">
                  {techs.map((tech) => {
                    const intensity = tech.count / maxCount;
                    const heatColor =
                      intensity > 0.7
                        ? "bg-red-100 border-red-300 hover:bg-red-200"
                        : intensity > 0.4
                        ? "bg-orange-100 border-orange-300 hover:bg-orange-200"
                        : "bg-yellow-50 border-yellow-200 hover:bg-yellow-100";

                    return (
                      <div
                        key={tech.id}
                        className={`px-2 py-1.5 rounded border text-[10px] font-mono
                          cursor-default transition-all duration-200 hover:scale-[1.03] ${heatColor}`}
                        title={`${tech.id}: ${tech.name}\nSeen in ${tech.count} chain(s)\nMax severity: ${tech.maxSev}`}
                      >
                        <div className="font-bold text-gray-800">{tech.id}</div>
                        <div className="text-gray-500 truncate leading-tight">{tech.name}</div>
                        {tech.count > 1 && (
                          <div className="text-[9px] text-gray-600 mt-0.5">×{tech.count}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Heat legend */}
      <div className="flex items-center gap-3 text-[10px] text-gray-600">
        <span>Intensity:</span>
        <div className="flex items-center gap-1">
          <div className="w-8 h-2 rounded bg-yellow-50 border border-yellow-200" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-8 h-2 rounded bg-orange-100 border border-orange-300" />
          <span>Med</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-8 h-2 rounded bg-red-100 border border-red-300" />
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
