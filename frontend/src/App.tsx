import { useState, useCallback, useEffect, useRef } from "react";
import TargetSelector from "./components/TargetSelector";
import FileUpload from "./components/FileUpload";
import PipelineProgress from "./components/PipelineProgress";
import StatsPanel from "./components/StatsPanel";
import SeverityChart from "./components/SeverityChart";
import MitreHeatmap from "./components/MitreHeatmap";
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

type UploadedFile = { name: string; content: string; category: string };

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type Tab = "targets" | "upload";

export default function App() {
  const [tab, setTab] = useState<Tab>("targets");
  const [target, setTarget] = useState("pygoat");
  const [demo, setDemo] = useState(false);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepEvent[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const handleFilesSelected = useCallback((files: UploadedFile[]) => {
    setUploadedFiles(files);
  }, []);

  async function runAnalysis() {
    setRunning(true);
    setSteps([]);
    setReport(null);
    setError(null);

    let body: Record<string, unknown>;
    if (tab === "upload" && uploadedFiles.length > 0) {
      body = {
        target: "custom",
        demo: false,
        uploaded_files: uploadedFiles.map((f) => ({
          name: f.name,
          content: f.content,
          category: f.category,
        })),
      };
    } else {
      body = { target, demo };
    }

    try {
      const res = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const { run_id } = await res.json();

      const es = new EventSource(`${API}/analyze/${run_id}/stream`);
      esRef.current = es;
      es.onmessage = (e) => {
        const event: StepEvent = JSON.parse(e.data);
        setSteps((prev) => [...prev, event]);
        if (event.type === "complete" && event.report) {
          setReport(event.report);
          setRunning(false);
          es.close();
          esRef.current = null;
        }
        if (event.type === "error") {
          setError(event.message ?? "Unknown error");
          setRunning(false);
          es.close();
          esRef.current = null;
        }
      };
      es.onerror = () => {
        setError("Connection error. Is the backend running?");
        setRunning(false);
        es.close();
        esRef.current = null;
      };
    } catch {
      setError("Failed to connect to backend.");
      setRunning(false);
    }
  }

  function stopAnalysis() {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setRunning(false);
    setError("Analysis stopped by user.");
  }

  function exportReport() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clara-report-${report.target}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canAnalyze = tab === "targets" || (tab === "upload" && uploadedFiles.length > 0);

  type Section = "pipeline" | "summary" | "chains" | "severity" | "mitre";
  const [activeNav, setActiveNav] = useState<Section>("summary");

  const NAV_ITEMS: { id: Section; label: string; icon: JSX.Element }[] = [
    {
      id: "pipeline",
      label: "Pipeline",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      ),
    },
    {
      id: "summary",
      label: "Executive Summary",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
    {
      id: "chains",
      label: "Attack Chains",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.193-9.193a4.5 4.5 0 016.364 6.364l-4.5 4.5a4.5 4.5 0 01-7.244-1.242" />
        </svg>
      ),
    },
    {
      id: "severity",
      label: "Risk Analysis",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
        </svg>
      ),
    },
    {
      id: "mitre",
      label: "MITRE Mapping",
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zm0 9.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
    },
  ];

  const scrollToSection = (sectionId: Section) => {
    setActiveNav(sectionId);
    const element = document.getElementById(`section-${sectionId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Track which section is in view
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "-50% 0px -50% 0px",
      threshold: 0,
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id.replace("section-", "") as Section;
          setActiveNav(sectionId);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    NAV_ITEMS.forEach((item) => {
      const element = document.getElementById(`section-${item.id}`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [report]);

  // Top risks for sidebar
  const topRisks = report
    ? [...report.chains]
        .sort((a, b) => a.fix_priority - b.fix_priority)
        .slice(0, 4)
        .map((c) => ({
          name: c.name.length > 22 ? c.name.slice(0, 22) + "…" : c.name,
          score: Math.round(c.confidence * 10 * (c.severity === "critical" ? 1.0 : c.severity === "high" ? 0.85 : c.severity === "medium" ? 0.7 : 0.5)),
          severity: c.severity,
        }))
    : [];

  const sevBarColor: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-blue-400",
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900">CLARA</h1>
          </div>

          <div className="flex-1 text-center">
            <span className="text-[10px] text-gray-500 uppercase tracking-[0.2em]">
              Contextual Layered Analysis for Risk & Remediation
            </span>
          </div>

          {/* Agent Status */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">Agent Status:</span>
            <span className={`text-xs font-medium ${running ? "text-blue-600" : "text-green-600"}`}>
              {running ? "Running" : "Ready"}
            </span>
            <div className={`w-2 h-2 rounded-full ${running ? "bg-blue-500 animate-pulse" : "bg-green-500"}`} />
          </div>

          {/* Export button */}
          {report && (
            <button
              onClick={exportReport}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-300
                hover:border-blue-500 text-gray-600 hover:text-blue-600 text-xs transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export
            </button>
          )}

          {/* Run / Stop button */}
          {running ? (
            <button
              onClick={stopAnalysis}
              className="px-5 py-2 rounded-lg text-xs font-bold text-white
                transition-all duration-200 bg-red-600 hover:bg-red-500 hover:shadow-md"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={runAnalysis}
              disabled={!canAnalyze}
              className="px-5 py-2 rounded-lg text-xs font-bold text-white
                transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed
                bg-blue-600 hover:bg-blue-500 hover:shadow-md"
            >
              Run Agent
            </button>
          )}
        </div>
      </header>

      {/* Body: sidebar + main + right sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar ── */}
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
          {/* Target selector */}
          <div className="p-4 border-b border-gray-200">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={running}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="pygoat">🐍 PyGoat</option>
              <option value="juice-shop">🧃 Juice Shop</option>
              <option value="impacket">🔧 Impacket</option>
            </select>
            <label className="flex items-center gap-2 text-[11px] text-gray-500 mt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={demo}
                onChange={(e) => setDemo(e.target.checked)}
                disabled={running}
                className="accent-blue-500 w-3 h-3"
              />
              Demo mode
            </label>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-2">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                  ${activeNav === item.id
                    ? "text-blue-600 bg-blue-50 border-r-2 border-blue-600 font-medium"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <span className="text-[9px] text-gray-400 font-mono">
              CLARA · Hook'em Hacks 2026
            </span>
          </div>
        </aside>

        {/* ── Center Content ── */}
        <main className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-red-700">Analysis Error</h3>
                  <p className="text-xs text-red-600 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Pipeline Section */}
          <section id="section-pipeline" className="scroll-mt-6">
            <div className="space-y-5">
              {/* Input Section */}
              <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setTab("targets")}
                    disabled={running}
                    className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-widest
                      border-b-2 -mb-px ${
                        tab === "targets"
                          ? "text-blue-600 border-blue-500 bg-blue-50"
                          : "text-gray-500 border-transparent hover:text-gray-800"
                      }`}
                  >
                    Demo Targets
                  </button>
                  <button
                    onClick={() => setTab("upload")}
                    disabled={running}
                    className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-widest
                      border-b-2 -mb-px ${
                        tab === "upload"
                          ? "text-blue-600 border-blue-500 bg-blue-50"
                          : "text-gray-500 border-transparent hover:text-gray-800"
                      }`}
                  >
                    Upload Scans
                  </button>
                </div>
                <div className="p-5">
                  {tab === "targets" && (
                    <TargetSelector value={target} onChange={setTarget} disabled={running} />
                  )}
                  {tab === "upload" && (
                    <FileUpload onFilesSelected={handleFilesSelected} disabled={running} />
                  )}
                </div>
              </section>

              {/* Progress Bar */}
              {(running || steps.length > 0) && (
                <PipelineProgress steps={steps} running={running} />
              )}

              {!report && !running && steps.length === 0 && (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 mb-4">
                    <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Select a target and run the agent</h3>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    CLARA will ingest scanner data, deduplicate, cluster, synthesize attack chains, and map to MITRE ATT&CK.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Executive Summary Section */}
          {report && (
            <section id="section-summary" className="scroll-mt-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
                <h2 className="text-base font-bold text-gray-900">Executive Summary</h2>
                <span className="text-[10px] text-blue-600 font-mono">{report.target}</span>
                <p className="text-gray-700 text-sm leading-relaxed">{report.executive_summary}</p>
              </div>
            </section>
          )}

          {/* Attack Chains Section */}
          {report && (
            <section id="section-chains" className="scroll-mt-6">
              <div className="space-y-4">
                <h2 className="text-base font-bold text-gray-900">Attack Chains</h2>
                {[...report.chains]
                  .sort((a, b) => a.fix_priority - b.fix_priority)
                  .map((chain) => (
                    <AttackChainCard key={chain.id} chain={chain} />
                  ))}
              </div>
            </section>
          )}

          {/* Risk Analysis Section */}
          {report && (
            <section id="section-severity" className="scroll-mt-6">
              <div className="space-y-5">
                <h2 className="text-base font-bold text-gray-900">Risk Analysis</h2>
                <StatsPanel report={report} />
              </div>
            </section>
          )}

          {/* MITRE ATT&CK Section */}
          {report && (
            <section id="section-mitre" className="scroll-mt-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <MitreHeatmap chains={report.chains} />
              </div>
            </section>
          )}
        </main>

        {/* ── Right Sidebar ── */}
        {report && (
          <aside className="w-72 bg-white border-l border-gray-200 overflow-y-auto shrink-0 hidden xl:block">
            {/* Executive Summary */}
            <div className="p-5 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Executive Summary</h3>
              <p className="text-xs text-gray-600 leading-relaxed line-clamp-[12]">
                {report.executive_summary}
              </p>
            </div>

            {/* Severity Distribution */}
            <div className="p-5 border-b border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded bg-purple-50 border border-purple-200 flex items-center justify-center">
                  <svg className="w-3 h-3 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                  </svg>
                </div>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-widest">
                  Severity Distribution
                </h3>
              </div>
              <SeverityChart data={report.stats.findings_by_severity} />
            </div>

            {/* Top Risks Breakdown */}
            <div className="p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Top Risks Breakdown</h3>
              <div className="space-y-3">
                {topRisks.map((risk) => (
                  <div key={risk.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-700 font-medium">{risk.name}</span>
                      <span className="text-xs text-gray-900 font-bold font-mono">{risk.score.toFixed(1)}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${sevBarColor[risk.severity] ?? "bg-gray-400"}`}
                        style={{ width: `${Math.min(risk.score * 10, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="mt-5 flex items-center gap-4 text-[10px] text-gray-500">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  Original Severity
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  AI Risk Score
                </span>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
