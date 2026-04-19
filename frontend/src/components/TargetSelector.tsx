type Target = { id: string; label: string; stack: string; tools: string[]; icon: string; desc: string };

const TARGETS: Target[] = [
  {
    id: "pygoat",
    label: "PyGoat",
    stack: "Python / Django",
    tools: ["bandit", "zap", "osv"],
    icon: "🐍",
    desc: "Intentionally vulnerable Django app",
  },
  {
    id: "juice-shop",
    label: "Juice Shop",
    stack: "Node.js / Angular",
    tools: ["zap", "npm audit"],
    icon: "🧃",
    desc: "OWASP vulnerable e-commerce app",
  },
  {
    id: "impacket",
    label: "Impacket",
    stack: "Python library",
    tools: ["bandit", "osv"],
    icon: "🔧",
    desc: "Network protocol security toolkit",
  },
];

type Props = { value: string; onChange: (v: string) => void; disabled?: boolean; scannedTargets?: Set<string> };

export default function TargetSelector({ value, onChange, disabled, scannedTargets }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {TARGETS.map((t) => {
        const selected = value === t.id;
        const scanned = scannedTargets?.has(t.id) ?? false;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            disabled={disabled}
            className={`group relative flex flex-col items-start px-5 py-4 rounded-xl border text-left
              transition-all duration-300 overflow-hidden
              ${selected
                ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-40"
              }`}
          >
            {/* Top-right indicators */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              {scanned && !selected && (
                <div className="w-5 h-5 rounded-full bg-green-100 border border-green-300
                  flex items-center justify-center" title="Scan cached">
                  <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              )}
              {selected && (
                <div className="w-5 h-5 rounded-full bg-blue-100 border border-blue-300
                  flex items-center justify-center">
                  <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="relative">
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="text-lg">{t.icon}</span>
                <span className="font-bold text-sm tracking-wide">{t.label}</span>
              </div>
              <span className={`text-[10px] font-mono ${selected ? "text-blue-600" : "text-gray-500"}`}>
                {t.stack}
              </span>
              <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">{t.desc}</p>
              <div className="flex gap-1.5 mt-3">
                {t.tools.map((tool) => (
                  <span
                    key={tool}
                    className={`text-[9px] px-2 py-0.5 rounded-md border font-mono
                      ${selected
                        ? "border-blue-300 bg-blue-100 text-blue-700"
                        : "border-gray-200 bg-gray-100 text-gray-600"
                      }`}
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
