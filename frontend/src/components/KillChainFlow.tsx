import type { Chain } from "../App";

type Props = { chains: Chain[] };

const SEV: Record<string, { fill: string; stroke: string; text: string; bg: string }> = {
  critical: { fill: "#fef2f2", stroke: "#ef4444", text: "#991b1b", bg: "#fee2e2" },
  high:     { fill: "#fff7ed", stroke: "#f97316", text: "#9a3412", bg: "#ffedd5" },
  medium:   { fill: "#fefce8", stroke: "#eab308", text: "#854d0e", bg: "#fef9c3" },
  low:      { fill: "#eff6ff", stroke: "#3b82f6", text: "#1e40af", bg: "#dbeafe" },
};

export default function KillChainFlow({ chains }: Props) {
  if (chains.length === 0) return null;

  const sorted = [...chains].sort((a, b) => a.fix_priority - b.fix_priority);
  const nodeH = 58;
  const nodeW = 320;
  const gap = 12;
  const padL = 50;
  const padT = 10;
  const svgH = sorted.length * (nodeH + gap) + padT * 2;
  const svgW = padL + nodeW + 30;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-blue-50 border border-blue-200 flex items-center justify-center">
          <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        </div>
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-widest">
          Attack Chain Priority
        </h3>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full"
          style={{ maxHeight: "500px" }}
        >
          <line
            x1={padL - 18} y1={padT}
            x2={padL - 18} y2={svgH - padT}
            stroke="#cbd5e1"
            strokeWidth={2}
            strokeDasharray="6 4"
          />

          {sorted.map((chain, i) => {
            const y = padT + i * (nodeH + gap);
            const c = SEV[chain.severity] ?? SEV.low;

            return (
              <g
                key={chain.id}
              >
                {/* Pulsing dot on timeline */}
                <circle cx={padL - 18} cy={y + nodeH / 2} r={5} fill={c.stroke} opacity={0.9}>
                  <animate attributeName="r" values="4;7;4" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2.5s" repeatCount="indefinite" />
                </circle>

                {/* Ripple */}
                <circle cx={padL - 18} cy={y + nodeH / 2} r={5} fill="none" stroke={c.stroke} strokeWidth={1}>
                  <animate attributeName="r" values="5;16" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" />
                </circle>

                {/* Arm to node */}
                <line
                  x1={padL - 12} y1={y + nodeH / 2}
                  x2={padL} y2={y + nodeH / 2}
                  stroke={c.stroke} strokeWidth={1.5} opacity={0.4}
                />

                {/* Node card */}
                <rect
                  x={padL} y={y}
                  width={nodeW} height={nodeH}
                  rx={10} ry={10}
                  fill={c.fill}
                  stroke={c.stroke} strokeWidth={1.2} strokeOpacity={0.5}
                />

                {/* Glow effect */}
                <rect
                  x={padL} y={y}
                  width={nodeW} height={nodeH}
                  rx={10} ry={10}
                  fill="none"
                  stroke={c.stroke} strokeWidth={0.5} strokeOpacity={0.2}
                  filter="url(#glow)"
                />

                {/* Priority badge */}
                <rect
                  x={padL + 8} y={y + 8}
                  width={32} height={24}
                  rx={6}
                  fill={c.bg}
                />
                <text
                  x={padL + 24} y={y + 25}
                  fill={c.text}
                  fontSize={13} fontWeight="bold" fontFamily="monospace"
                  textAnchor="middle"
                >
                  #{chain.fix_priority}
                </text>

                {/* Chain name */}
                <text
                  x={padL + 50} y={y + 24}
                  fill={c.text}
                  fontSize={12} fontWeight="600"
                >
                  {chain.name.length > 36 ? chain.name.slice(0, 36) + "…" : chain.name}
                </text>

                {/* Meta line */}
                <text
                  x={padL + 50} y={y + 42}
                  fill="#6b7280"
                  fontSize={10} fontFamily="monospace"
                >
                  {chain.severity} · {Math.round(chain.confidence * 100)}% conf · {chain.mitre_techniques?.length ?? 0} techniques · {chain.finding_ids?.length ?? 0} findings
                </text>
              </g>
            );
          })}

          {/* SVG filter for glow */}
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>
      </div>
    </div>
  );
}
