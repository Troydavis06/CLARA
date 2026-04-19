import { useEffect, useState } from "react";
import type { Report } from "../App";

function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{display}</>;
}

type Props = { report: Report };

export default function StatsPanel({ report }: Props) {
  // Count chains with critical severity (findings themselves rarely get that label from scanners)
  const criticalCount = report.chains?.filter((c) => c.severity === "critical").length ?? 0;

  const stats = [
    {
      label: "Total Findings",
      value: report.stats.total_findings,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      ),
      color: "text-cyan-600",
      iconBg: "bg-cyan-50 text-cyan-600",
      border: "border-cyan-200",
      glow: "hover:shadow-cyan-100",
      pulse: false,
    },
    {
      label: "Duplicates Removed",
      value: report.stats.duplicates_removed,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m0 0l2.25 2.25M9.75 14.25l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6.75a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6.75v11.25A2.25 2.25 0 006 20.25z" />
        </svg>
      ),
      color: "text-yellow-600",
      iconBg: "bg-yellow-50 text-yellow-600",
      border: "border-yellow-200",
      glow: "hover:shadow-yellow-100",
      pulse: false,
    },
    {
      label: "Unique Findings",
      value: report.stats.total_findings - report.stats.duplicates_removed,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      ),
      color: "text-blue-600",
      iconBg: "bg-blue-50 text-blue-600",
      border: "border-blue-200",
      glow: "hover:shadow-blue-100",
      pulse: false,
    },
    {
      label: "Critical Chains",
      value: criticalCount,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
      color: "text-red-600",
      iconBg: "bg-red-100 text-red-600",
      border: "border-red-400",
      glow: "hover:shadow-red-200",
      pulse: criticalCount > 0,
    },
  ];

  // Tool distribution
  const toolEntries = Object.entries(report.stats.findings_by_tool).filter(([, v]) => v > 0);

  return (
    <div className="space-y-4">
      {/* Main counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`bg-white rounded-xl p-4 ${s.border} border ${s.glow}
              hover:shadow-md transition-all duration-300 relative`}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            {s.pulse && (
              <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
            )}
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center`}>
                {s.icon}
              </div>
              <span className="text-[10px] text-gray-600 uppercase tracking-wider leading-tight">
                {s.label}
              </span>
            </div>
            <div className={`text-3xl font-bold font-mono ${s.color} animate-count-pop`}>
              <AnimatedCounter value={s.value} />
            </div>
          </div>
        ))}
      </div>

      {/* Tool distribution bar */}
      {toolEntries.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">
            Findings by Scanner
          </div>
          <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-gray-200">
            {toolEntries.map(([tool, count], i) => {
              const pct = (count / report.stats.total_findings) * 100;
              const colors = [
                "bg-blue-500",
                "bg-cyan-500",
                "bg-purple-500",
                "bg-orange-500",
                "bg-pink-500",
              ];
              return (
                <div
                  key={tool}
                  className={`${colors[i % colors.length]} transition-all duration-1000 rounded-full`}
                  style={{ width: `${pct}%` }}
                  title={`${tool}: ${count} findings (${Math.round(pct)}%)`}
                />
              );
            })}
          </div>
          <div className="flex gap-4 mt-2 flex-wrap">
            {toolEntries.map(([tool, count], i) => {
              const colors = [
                "text-blue-600",
                "text-cyan-600",
                "text-purple-600",
                "text-orange-600",
                "text-pink-600",
              ];
              const dotColors = [
                "bg-blue-500",
                "bg-cyan-500",
                "bg-purple-500",
                "bg-orange-500",
                "bg-pink-500",
              ];
              return (
                <div key={tool} className="flex items-center gap-1.5 text-[10px]">
                  <div className={`w-2 h-2 rounded-full ${dotColors[i % dotColors.length]}`} />
                  <span className="text-gray-500">{tool}</span>
                  <span className={`font-mono font-bold ${colors[i % colors.length]}`}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
