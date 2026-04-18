import type { StepEvent } from "../App";

const STEPS = [
  { key: "ingest",           label: "Ingest" },
  { key: "dedup",            label: "Dedup" },
  { key: "cluster",          label: "Cluster" },
  { key: "synthesize",       label: "Synthesize" },
  { key: "mitre_prioritize", label: "MITRE Map" },
  { key: "report",           label: "Report" },
];

type Props = { steps: StepEvent[]; running: boolean };

export default function PipelineProgress({ steps, running }: Props) {
  const completedSteps = new Set(
    steps.filter((e) => e.type === "step_complete").map((e) => e.step)
  );
  const activeStep = steps.findLast((e) => e.type === "step_start")?.step;
  const synthChains = steps.filter((e) => e.type === "chain_preview");
  const synthNarrative = synthChains
    .map((e) => `[${e.name}] ${e.narrative_preview}`)
    .join("\n\n");

  const summaries: Record<string, string> = {};
  for (const e of steps) {
    if (e.type === "step_complete" && e.step && e.result_summary) {
      summaries[e.step] = e.result_summary;
    }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-5">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">Pipeline</h2>

      {/* Step indicators */}
      <div className="flex gap-2 flex-wrap">
        {STEPS.map((s, i) => {
          const done = completedSteps.has(s.key);
          const active = activeStep === s.key;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${done    ? "bg-emerald-900 text-emerald-300 border border-emerald-700" :
                    active  ? "bg-blue-900 text-blue-200 border border-blue-600 animate-pulse" :
                              "bg-gray-800 text-gray-500 border border-gray-700"
                  }`}
              >
                <span>{i + 1}</span>
                <span>{s.label}</span>
                {done && <span>✓</span>}
              </div>
              {i < STEPS.length - 1 && (
                <span className="text-gray-700">→</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Step summaries */}
      {Object.entries(summaries).length > 0 && (
        <div className="space-y-1">
          {STEPS.filter((s) => summaries[s.key]).map((s) => (
            <div key={s.key} className="flex gap-3 text-xs text-gray-500">
              <span className="text-emerald-600 w-24 shrink-0">[{s.label}]</span>
              <span>{summaries[s.key]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Synthesis streaming preview */}
      {synthNarrative && (
        <div className="mt-2">
          <div className="text-xs text-gray-500 mb-1 uppercase tracking-widest">
            Synthesizing Attack Chains
          </div>
          <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-xs text-emerald-300
                          font-mono leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
            {synthNarrative}
            {running && activeStep === "synthesize" && (
              <span className="animate-pulse text-emerald-500">▋</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
