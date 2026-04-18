type Target = { id: string; label: string; stack: string; tools: string[] };

const TARGETS: Target[] = [
  { id: "pygoat",     label: "pygoat",     stack: "Python/Django",  tools: ["bandit", "zap", "osv"] },
  { id: "juice-shop", label: "Juice Shop", stack: "Node.js/Angular", tools: ["zap", "npm audit"] },
  { id: "impacket",   label: "Impacket",   stack: "Python library", tools: ["bandit", "osv"] },
];

type Props = { value: string; onChange: (v: string) => void; disabled?: boolean };

export default function TargetSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="flex gap-3 flex-wrap">
      {TARGETS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          disabled={disabled}
          className={`flex flex-col items-start px-4 py-3 rounded-lg border text-left transition-colors
            ${value === t.id
              ? "border-emerald-500 bg-emerald-950 text-emerald-200"
              : "border-gray-700 bg-gray-800 hover:border-gray-600 text-gray-300 disabled:opacity-50"
            }`}
        >
          <span className="font-semibold text-sm">{t.label}</span>
          <span className="text-xs text-gray-500 mt-0.5">{t.stack}</span>
          <span className="text-xs text-gray-600 mt-1">{t.tools.join(" · ")}</span>
        </button>
      ))}
    </div>
  );
}
