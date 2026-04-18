import { useMemo } from "react";

type Props = {
  data: Record<string, number>;
};

const COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  informational: "#6b7280",
};

export default function SeverityChart({ data }: Props) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);

  const segments = useMemo(() => {
    if (total === 0) return [];

    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return Object.entries(data)
      .filter(([, v]) => v > 0)
      .sort(([a], [b]) => {
        const order = ["critical", "high", "medium", "low", "informational"];
        return order.indexOf(a) - order.indexOf(b);
      })
      .map(([sev, count], i) => {
        const pct = count / total;
        const dash = pct * circumference;
        const seg = {
          severity: sev,
          count,
          pct,
          color: COLORS[sev] ?? "#6b7280",
          dashArray: `${dash} ${circumference - dash}`,
          dashOffset: -offset,
          delay: i * 0.15,
        };
        offset += dash;
        return seg;
      });
  }, [data, total]);

  if (total === 0) return null;

  return (
    <div className="flex items-center gap-6">
      {/* Donut */}
      <div className="relative w-[140px] h-[140px] shrink-0">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          {/* Background ring */}
          <circle
            cx="70" cy="70" r="60"
            fill="none" stroke="#e5e7eb" strokeWidth="14"
          />
          {/* Segments */}
          {segments.map((seg) => (
            <circle
              key={seg.severity}
              cx="70" cy="70" r="60"
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              strokeLinecap="round"
              className="donut-segment"
              style={{ animationDelay: `${seg.delay}s` }}
            />
          ))}
        </svg>
        {/* Center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{total}</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">findings</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2">
        {segments.map((seg, i) => (
          <div
            key={seg.severity}
            className="flex items-center gap-2.5 text-xs"
          >
            <div
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ background: seg.color }}
            />
            <span className="text-gray-600 capitalize w-24">{seg.severity}</span>
            <span className="text-gray-900 font-mono font-bold w-6 text-right">
              {seg.count}
            </span>
            <span className="text-gray-600 font-mono">
              {Math.round(seg.pct * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
