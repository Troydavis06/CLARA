import { useState } from "react";
import TargetSelector from "./components/TargetSelector";
import PipelineProgress from "./components/PipelineProgress";
import AttackChainCard from "./components/AttackChainCard";

export type StepEvent = {
  type: "step_start" | "step_complete" | "chain_preview" | "complete" | "error";
  step?: string;
  label?: string;
  step_num?: number;
  total?: number;
  result_summary?: string;
  chain_id?: string;
  name?: string;
  severity?: string;
  narrative_preview?: string;
  report?: Report;
  message?: string;
};

export type MitreTechnique = { id: string; name: string; tactic: string };

export type Chain = {
  id: string;
  name: string;
  severity: string;
  fix_priority: number;
  confidence: number;
  narrative: string;
  business_impact: string;
  finding_ids: string[];
  clusters_spanned: string[];
  mitre_techniques: MitreTechnique[];
  blast_radius_notes: string;
};

export type Report = {
  target: string;
  executive_summary: string;
  stats: {
    total_findings: number;
    duplicates_removed: number;
    findings_by_severity: Record<string, number>;
    findings_by_tool: Record<string, number>;
    total_chains: number;
  };
  chains: Chain[];
};

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function App() {
  const [target, setTarget] = useState("pygoat");
  const [demo, setDemo] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setRunning(true);
    setSteps([]);
    setReport(null);
    setError(null);

    const res = await fetch(`${API}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, demo }),
    });
    const { run_id } = await res.json();

    const es = new EventSource(`${API}/analyze/${run_id}/stream`);
    es.onmessage = (e) => {
      const event: StepEvent = JSON.parse(e.data);
      setSteps((prev) => [...prev, event]);
      if (event.type === "complete" && event.report) {
        setReport(event.report);
        setRunning(false);
        es.close();
      }
      if (event.type === "error") {
        setError(event.message ?? "Unknown error");
        setRunning(false);
        es.close();
      }
    };
    es.onerror = () => {
      setError("Connection error. Is the backend running?");
      setRunning(false);
      es.close();
    };
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">
      {/* Header */}
      <header className="border-b border-gray-800 px-8 py-4 flex items-center gap-4">
        <span className="text-2xl font-bold text-emerald-400">CLARA</span>
        <span className="text-gray-500 text-sm">
          Contextual Layered Analysis for Risk &amp; Remediation
        </span>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-8 space-y-8">
        {/* Target selector + controls */}
        <section className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
            Select Target
          </h2>
          <TargetSelector value={target} onChange={setTarget} disabled={running} />
          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={demo}
                onChange={(e) => setDemo(e.target.checked)}
                disabled={running}
                className="accent-emerald-500"
              />
              Demo mode (pre-baked results, no API calls)
            </label>
            <button
              onClick={runAnalysis}
              disabled={running}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500
                         rounded-lg text-sm font-semibold transition-colors"
            >
              {running ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        </section>

        {/* Pipeline progress */}
        {(running || steps.length > 0) && (
          <PipelineProgress steps={steps} running={running} />
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-950 border border-red-800 rounded-xl p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {report && (
          <section className="space-y-6">
            {/* Executive summary */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">
                Executive Summary — {report.target}
              </h2>
              <p className="text-gray-200 text-sm leading-relaxed">{report.executive_summary}</p>
              <div className="mt-4 flex gap-6 text-xs text-gray-500">
                <span>{report.stats.total_findings} findings</span>
                <span>{report.stats.duplicates_removed} duplicates removed</span>
                <span>{report.stats.total_chains} attack chains</span>
                {Object.entries(report.stats.findings_by_severity)
                  .filter(([, v]) => v > 0)
                  .map(([sev, count]) => (
                    <span key={sev} className={severityTextClass(sev)}>
                      {count} {sev}
                    </span>
                  ))}
              </div>
            </div>

            {/* Attack chains */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
                Attack Chains
              </h2>
              {report.chains.map((chain) => (
                <AttackChainCard key={chain.id} chain={chain} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function severityTextClass(sev: string): string {
  return (
    {
      critical: "text-red-400",
      high: "text-orange-400",
      medium: "text-yellow-400",
      low: "text-blue-400",
    }[sev] ?? "text-gray-400"
  );
}
