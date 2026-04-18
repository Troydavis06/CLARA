import { useState, useRef, useCallback } from "react";

type Props = {
  onFilesSelected: (files: { name: string; content: string; category: string }[]) => void;
  disabled?: boolean;
};

const CATEGORIES = [
  { id: "sast", label: "SAST", desc: "Bandit, Semgrep, etc.", icon: "🔬" },
  { id: "dast", label: "DAST", desc: "ZAP, Burp, etc.", icon: "🌐" },
  { id: "oss", label: "OSS/SCA", desc: "OSV, npm audit, etc.", icon: "📦" },
];

export default function FileUpload({ onFilesSelected, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<{ name: string; content: string; category: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("sast");
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (fileList: FileList) => {
      const results: { name: string; content: string; category: string }[] = [];
      for (const file of Array.from(fileList)) {
        if (!file.name.endsWith(".json")) continue;
        const text = await file.text();
        // Validate JSON
        try {
          JSON.parse(text);
          results.push({ name: file.name, content: text, category: selectedCategory });
        } catch {
          // skip invalid JSON
        }
      }
      setFiles((prev) => [...prev, ...results]);
      onFilesSelected([...files, ...results]);
    },
    [selectedCategory, files, onFilesSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const removeFile = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx);
    setFiles(updated);
    onFilesSelected(updated);
  };

  return (
    <div className="space-y-3">
      {/* Category selector */}
      <div className="flex gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            disabled={disabled}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
              transition-all border
              ${selectedCategory === cat.id
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
              }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-2 p-8
          rounded-xl border-2 border-dashed cursor-pointer
          transition-all duration-300
          ${dragOver
            ? "border-blue-500 bg-blue-50 scale-[1.01]"
            : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
          }
          ${disabled ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && processFiles(e.target.files)}
        />

        <div className={`w-12 h-12 rounded-xl flex items-center justify-center
          ${dragOver ? "bg-blue-100" : "bg-gray-200"} transition-colors`}>
          <svg className={`w-6 h-6 ${dragOver ? "text-blue-600" : "text-gray-400"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>

        <div className="text-center">
          <span className={`text-sm font-medium ${dragOver ? "text-blue-600" : "text-gray-600"}`}>
            {dragOver ? "Drop files here" : "Drop scan JSON files or click to browse"}
          </span>
          <p className="text-[10px] text-gray-500 mt-1">
            Supports Bandit, ZAP, OSV, npm audit JSON formats
          </p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div
              key={`${f.name}-${i}`}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white border border-gray-200
                text-xs"
            >
              <span className="text-blue-600 font-mono">{f.category.toUpperCase()}</span>
              <span className="text-gray-700 flex-1 truncate">{f.name}</span>
              <span className="text-gray-500 font-mono">
                {(f.content.length / 1024).toFixed(1)}KB
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                className="text-gray-400 hover:text-red-600 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
