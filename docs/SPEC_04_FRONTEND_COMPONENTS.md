# SPEC 4: Frontend Component Specification
## CLARA React/TypeScript UI Components

**Version:** 1.0  
**Last Updated:** April 23, 2026  
**Framework:** React 18 + TypeScript + Vite + Tailwind CSS

---

## 1. Component Architecture

### 1.1 Component Hierarchy

```
App.tsx (Root)
├── CyberBackground.tsx              # Animated background (decorative)
├── Navigation Tabs
│   ├── "Targets" Tab
│   │   └── TargetSelector.tsx       # Pre-configured target picker
│   └── "Upload" Tab
│       └── FileUpload.tsx           # Drag-drop file upload
├── Action Section
│   └── [Analyze Button] [Stop Button] [Export Button]
├── Content Sections (conditional rendering based on activeNav)
│   ├── Pipeline Section
│   │   └── PipelineProgress.tsx    # Step-by-step progress
│   ├── Raw Alerts Section
│   │   └── [Raw Findings Table]    # Collapsible raw data view
│   ├── Summary Section
│   │   ├── StatsPanel.tsx          # Aggregate statistics
│   │   └── SeverityChart.tsx       # Pie/bar chart
│   ├── Chains Section
│   │   └── AttackChainCard.tsx × N # One per attack chain
│   ├── Severity Section
│   │   └── SeverityChart.tsx       # Detailed breakdown
│   └── MITRE Section
│       ├── MitreHeatmap.tsx        # Technique frequency heatmap
│       └── KillChainFlow.tsx       # Attack progression flow
```

### 1.2 State Management

**Global State (in App.tsx):**
```typescript
const [tab, setTab] = useState<'targets' | 'upload'>('targets');
const [target, setTarget] = useState('pygoat');
const demo = false;  // Hardcoded to false (demo mode removed in prod)
const [running, setRunning] = useState(false);
const [steps, setSteps] = useState<StepEvent[]>([]);
const [cachedReports, setCachedReports] = useState<Record<string, Report>>({});
const [error, setError] = useState<string | null>(null);
const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
const [rawAlertsOpen, setRawAlertsOpen] = useState(false);
const [activeNav, setActiveNav] = useState<Section>('summary');
```

**Derived State:**
```typescript
const report = cachedReports[target] ?? null;  // Current target's report
const canAnalyze = tab === 'targets' || (tab === 'upload' && uploadedFiles.length > 0);
```

**No Redux/Zustand** — Local useState hooks only

---

## 2. Component Specifications

### 2.1 TargetSelector.tsx

**Purpose:** Dropdown selector for pre-configured scan targets.

**Props:**
```typescript
type TargetSelectorProps = {
  target: string;
  setTarget: (target: string) => void;
  demo: boolean;
  setDemo: (demo: boolean) => void;
}
```

**UI Elements:**
- **Dropdown:** List of targets (pygoat, juice-shop, impacket)
- **Target Info Card:** Shows context, stack, tools for selected target
- **Demo Mode Checkbox:** Toggle between live and cached results

**State:** None (fully controlled component)

**API Calls:**
```typescript
useEffect(() => {
  fetch(`${API}/targets`)
    .then(res => res.json())
    .then(data => setTargets(data));
}, []);
```

**Styling:**
- Dark theme with cyan accent (--color-primary)
- Hover effect on dropdown options
- Badge icons for each tool (Bandit, ZAP, OSV)

**Example:**
```tsx
<TargetSelector
  target={target}
  setTarget={setTarget}
  demo={demo}
  setDemo={setDemo}
/>
```

---

### 2.2 FileUpload.tsx

**Purpose:** Drag-and-drop file upload interface for custom scans.

**Props:**
```typescript
type FileUploadProps = {
  onFilesSelected: (files: UploadedFile[]) => void;
}
```

**UI Elements:**
- **Drop Zone:** Dashed border, drag-over animation
- **File Picker:** Button to open system file dialog
- **File List:** Preview of uploaded files with category labels
- **Category Selector:** Dropdown to tag files as SAST/DAST/OSS

**State:**
```typescript
const [dragActive, setDragActive] = useState(false);
const [files, setFiles] = useState<UploadedFile[]>([]);
```

**File Processing:**
```typescript
const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  const fileList = Array.from(e.dataTransfer.files);
  
  const processed = await Promise.all(
    fileList.map(async (file) => ({
      name: file.name,
      content: await file.text(),  // Read file as text
      category: inferCategory(file.name),  // Auto-detect from filename
    }))
  );
  
  setFiles(processed);
  onFilesSelected(processed);
};

const inferCategory = (filename: string): 'sast' | 'dast' | 'oss' => {
  if (filename.includes('bandit')) return 'sast';
  if (filename.includes('zap')) return 'dast';
  if (filename.includes('npm') || filename.includes('osv')) return 'oss';
  return 'oss';  // default
};
```

**Validation:**
- Only accept `.json` files
- Max file size: 50MB
- Validate JSON structure on upload

**Styling:**
- Dashed border: `border-2 border-dashed border-cyan-500`
- Drag-over state: `bg-cyan-500/10`
- File badges: Color-coded by category (SAST=purple, DAST=orange, OSS=blue)

---

### 2.3 PipelineProgress.tsx

**Purpose:** Visual stepper showing analysis pipeline stages.

**Props:**
```typescript
type PipelineProgressProps = {
  steps: StepEvent[];
}
```

**UI Elements:**
- **Step Circles:** 6 numbered circles (1-6) for each pipeline stage
- **Progress Bar:** Connecting line showing completion percentage
- **Step Labels:** "Ingesting scanner data", "Deduplicating", etc.
- **Result Summaries:** Below each completed step

**Rendering Logic:**
```typescript
const PIPELINE_STEPS = [
  'ingest', 'dedup', 'cluster', 'synthesize', 'mitre_prioritize', 'report'
];

const completedSteps = steps.filter(s => s.type === 'step_complete');
const currentStep = steps.findLast(s => s.type === 'step_start')?.step;
const progress = (completedSteps.length / 6) * 100;
```

**State Classes:**
- **Pending:** Gray circle, dashed connector
- **Active:** Cyan circle with pulse animation
- **Complete:** Green circle with checkmark icon
- **Error:** Red circle with X icon

**Example:**
```tsx
<div className="flex items-center gap-4">
  {PIPELINE_STEPS.map((step, idx) => (
    <div key={step} className="flex items-center gap-2">
      <div className={`
        w-10 h-10 rounded-full flex items-center justify-center
        ${currentStep === step ? 'bg-cyan-500 animate-pulse' : 
          completedSteps.some(s => s.step === step) ? 'bg-green-500' : 'bg-gray-700'}
      `}>
        {idx + 1}
      </div>
      {idx < 5 && <div className="w-12 h-0.5 bg-gray-600" />}
    </div>
  ))}
</div>
```

---

### 2.4 StatsPanel.tsx

**Purpose:** Display aggregate vulnerability statistics.

**Props:**
```typescript
type StatsPanelProps = {
  stats: Report['stats'];
}
```

**UI Elements:**
- **Total Findings:** Large number with label
- **Duplicates Removed:** Badge showing reduction %
- **By Severity:** Color-coded list (Critical=red, High=orange, etc.)
- **By Tool:** Tool icons with counts

**Layout:**
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <StatCard title="Total Findings" value={stats.total_findings} />
  <StatCard title="Duplicates Removed" value={stats.duplicates_removed} />
  <StatCard title="Unique Findings" value={stats.total_findings - stats.duplicates_removed} />
  <StatCard title="Attack Chains" value={stats.total_chains} />
</div>
```

**Styling:**
- Glass morphism effect: `bg-gray-800/50 backdrop-blur-sm`
- Gradient borders for severity badges

---

### 2.5 SeverityChart.tsx

**Purpose:** Pie chart visualizing severity distribution.

**Props:**
```typescript
type SeverityChartProps = {
  findings_by_severity: Record<string, number>;
}
```

**Chart Library:** None (pure CSS-based chart alternative) OR recharts (if installed)

**Data Transformation:**
```typescript
const chartData = Object.entries(findings_by_severity).map(([severity, count]) => ({
  name: severity.charAt(0).toUpperCase() + severity.slice(1),
  value: count,
  color: SEVERITY_COLORS[severity],
}));

const SEVERITY_COLORS = {
  critical: '#ef4444',  // red-500
  high: '#f97316',      // orange-500
  medium: '#eab308',    // yellow-500
  low: '#3b82f6',       // blue-500
  informational: '#6b7280',  // gray-500
};
```

**Pure CSS Version:**
```tsx
const total = Object.values(findings_by_severity).reduce((a, b) => a + b, 0);
let cumulativePercent = 0;

return (
  <div className="relative w-64 h-64 rounded-full" style={{
    background: Object.entries(findings_by_severity).map(([sev, count]) => {
      const percent = (count / total) * 100;
      const gradient = `${SEVERITY_COLORS[sev]} ${cumulativePercent}% ${cumulativePercent + percent}%`;
      cumulativePercent += percent;
      return gradient;
    }).join(','),
    backgroundImage: `conic-gradient(${/* gradients */})`
  }} />
);
```

**Legend:**
- Color swatches with labels
- Percentage and count for each severity

---

### 2.6 MitreHeatmap.tsx

**Purpose:** Heatmap showing MITRE ATT&CK technique frequency across attack chains.

**Props:**
```typescript
type MitreHeatmapProps = {
  chains: Chain[];
}
```

**Data Processing:**
```typescript
// Extract all techniques from all chains
const techniques = chains.flatMap(c => c.mitre_techniques);

// Count frequency of each technique
const techniqueCount = techniques.reduce((acc, tech) => {
  acc[tech.id] = (acc[tech.id] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

// Group by tactic
const tacticGroups = techniques.reduce((acc, tech) => {
  if (!acc[tech.tactic]) acc[tech.tactic] = [];
  acc[tech.tactic].push(tech);
  return acc;
}, {} as Record<string, MitreTechnique[]>);
```

**UI Layout:**
```tsx
<div className="grid grid-cols-[auto_1fr] gap-2">
  {/* Tactic labels */}
  <div className="flex flex-col gap-2">
    {Object.keys(tacticGroups).map(tactic => (
      <div key={tactic} className="text-sm text-gray-400">{tactic}</div>
    ))}
  </div>
  
  {/* Technique cells */}
  <div className="grid grid-cols-5 gap-2">
    {Object.entries(techniqueCount).map(([id, count]) => (
      <div
        key={id}
        className="p-2 rounded text-xs cursor-pointer hover:scale-105"
        style={{
          backgroundColor: `rgba(6, 182, 212, ${count / maxCount})`,  // cyan with opacity
        }}
        title={`${id}: ${techniques.find(t => t.id === id)?.name}`}
      >
        {id}
      </div>
    ))}
  </div>
</div>
```

**Interactivity:**
- Hover tooltip shows technique name and count
- Click to filter attack chains by technique
- Color intensity = frequency (darker = more common)

---

### 2.7 AttackChainCard.tsx

**Purpose:** Expandable card displaying attack chain details.

**Props:**
```typescript
type AttackChainCardProps = {
  chain: Chain;
  onSuggestFix?: (chain: Chain) => void;
}
```

**UI Elements:**
- **Header:** Chain name + severity badge + priority score
- **Summary Row:** Confidence, finding count, clusters spanned
- **Narrative:** Numbered steps (collapsible)
- **Business Impact:** Warning box with impact description
- **MITRE Tags:** Badge list of ATT&CK techniques
- **Locations:** File paths affected
- **Actions:** "Suggest Fix" button, "View Raw Findings" toggle

**State:**
```typescript
const [expanded, setExpanded] = useState(false);
const [showFix, setShowFix] = useState(false);
const [fixSuggestion, setFixSuggestion] = useState<string | null>(null);
const [loading, setLoading] = useState(false);
```

**API Call (Suggest Fix):**
```typescript
const handleSuggestFix = async () => {
  setLoading(true);
  try {
    const response = await fetch(`${API}/suggest-fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chain_name: chain.name,
        severity: chain.severity,
        narrative: chain.narrative,
        business_impact: chain.business_impact,
        locations: chain.locations,
      }),
    });
    const data = await response.json();
    setFixSuggestion(data.suggestion);
    setShowFix(true);
  } catch (error) {
    console.error('Fix suggestion failed:', error);
  } finally {
    setLoading(false);
  }
};
```

**Styling:**
- Severity colors: Critical=red glow, High=orange, Medium=yellow, Low=blue
- Glass morphism: `bg-gray-900/80 backdrop-blur-md border border-gray-700`
- Expand animation: `transition-all duration-300`

**Example:**
```tsx
<div className={`
  rounded-lg p-6 border-l-4
  ${chain.severity === 'critical' ? 'border-red-500 shadow-red-500/50' :
    chain.severity === 'high' ? 'border-orange-500' : 'border-yellow-500'}
`}>
  <h3 className="text-xl font-bold">{chain.name}</h3>
  <div className="flex gap-2 mt-2">
    <Badge color={SEVERITY_COLORS[chain.severity]}>{chain.severity.toUpperCase()}</Badge>
    <Badge>Priority: {chain.fix_priority}/10</Badge>
    <Badge>Confidence: {(chain.confidence * 100).toFixed(0)}%</Badge>
  </div>
  
  {expanded && (
    <div className="mt-4 space-y-4">
      <div className="whitespace-pre-wrap text-sm">{chain.narrative}</div>
      <div className="bg-orange-500/10 p-4 rounded border border-orange-500">
        <strong>Business Impact:</strong> {chain.business_impact}
      </div>
      <div className="flex flex-wrap gap-2">
        {chain.mitre_techniques.map(tech => (
          <Badge key={tech.id} variant="outline">{tech.id}: {tech.name}</Badge>
        ))}
      </div>
    </div>
  )}
  
  <button onClick={() => setExpanded(!expanded)} className="mt-4 text-cyan-400">
    {expanded ? '▲ Collapse' : '▼ Expand'}
  </button>
  
  {expanded && (
    <button onClick={handleSuggestFix} disabled={loading} className="mt-2 btn-primary">
      {loading ? 'Generating...' : '🔧 Suggest Fix'}
    </button>
  )}
  
  {showFix && fixSuggestion && (
    <div className="mt-4 bg-green-500/10 p-4 rounded border border-green-500">
      <ReactMarkdown>{fixSuggestion}</ReactMarkdown>
    </div>
  )}
</div>
```

---

### 2.8 KillChainFlow.tsx

**Purpose:** Flow diagram showing attack progression through kill chain stages.

**Props:**
```typescript
type KillChainFlowProps = {
  chains: Chain[];
}
```

**Kill Chain Stages:**
1. Initial Access
2. Execution
3. Persistence
4. Privilege Escalation
5. Defense Evasion
6. Credential Access
7. Discovery
8. Lateral Movement
9. Collection
10. Exfiltration
11. Impact

**Data Mapping:**
```typescript
const stageMapping = {
  'Initial Access': chains.filter(c => c.mitre_techniques.some(t => t.tactic === 'Initial Access')),
  'Execution': chains.filter(c => c.mitre_techniques.some(t => t.tactic === 'Execution')),
  // ... etc
};
```

**UI Rendering:**
```tsx
<div className="flex items-center justify-between">
  {KILL_CHAIN_STAGES.map((stage, idx) => (
    <div key={stage} className="flex items-center">
      <div className={`
        w-32 h-20 flex items-center justify-center rounded-lg border-2
        ${stageMapping[stage].length > 0 ? 'border-red-500 bg-red-500/20' : 'border-gray-600'}
      `}>
        <div className="text-center">
          <div className="text-xs text-gray-400">{stage}</div>
          <div className="text-2xl font-bold">{stageMapping[stage].length}</div>
        </div>
      </div>
      {idx < KILL_CHAIN_STAGES.length - 1 && (
        <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 3l7 7-7 7V3z" />
        </svg>
      )}
    </div>
  ))}
</div>
```

---

### 2.9 CyberBackground.tsx

**Purpose:** Animated background with matrix-style effects.

**Props:** None

**Animation:**
- Falling characters (0s, 1s, binary)
- Grid lines pulsing
- Gradient overlays

**Implementation:**
```tsx
export default function CyberBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-gray-950">
      {/* Animated grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d420_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#06b6d420_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-transparent to-purple-950/20" />
      
      {/* Falling characters (optional, performance-intensive) */}
      {/* Matrix rain animation via canvas or CSS keyframes */}
    </div>
  );
}
```

---

## 3. Styling System

### 3.1 Tailwind Configuration

**tailwind.config.js:**
```javascript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#06b6d4',    // cyan-500
        'primary-dark': '#0891b2',  // cyan-600
        danger: '#ef4444',      // red-500
        warning: '#f97316',     // orange-500
        success: '#10b981',     // green-500
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
```

### 3.2 Custom CSS (index.css)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #1f2937;
}
::-webkit-scrollbar-thumb {
  background: #06b6d4;
  border-radius: 4px;
}

/* Glass morphism utility */
.glass {
  background: rgba(17, 24, 39, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(6, 182, 212, 0.2);
}

/* Button styles */
.btn-primary {
  @apply px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-lg transition-colors;
}

.btn-secondary {
  @apply px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors;
}

.btn-danger {
  @apply px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors;
}
```

### 3.3 Color Palette

| Color Name | Hex | Use Case |
|------------|-----|----------|
| Primary (Cyan) | #06b6d4 | Buttons, links, highlights |
| Critical | #ef4444 | Critical severity, errors |
| High | #f97316 | High severity, warnings |
| Medium | #eab308 | Medium severity |
| Low | #3b82f6 | Low severity, info |
| Background | #030712 | Page background (gray-950) |
| Surface | #111827 | Card backgrounds (gray-900) |
| Border | #374151 | Dividers, outlines (gray-700) |

---

## 4. Responsive Design

### 4.1 Breakpoints (Tailwind Defaults)

| Breakpoint | Min Width | Target Devices |
|------------|-----------|----------------|
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large monitors |

### 4.2 Mobile Optimizations

**Navigation:**
- Stack tabs vertically on mobile
- Hamburger menu for section navigation

**Charts:**
- Reduce legend size
- Simplify heatmap to list view

**Attack Chain Cards:**
- Full-width on mobile
- Collapse narrative by default

**Example:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Cards auto-stack on mobile */}
</div>
```

---

## 5. Accessibility

### 5.1 ARIA Labels

```tsx
<button
  onClick={runAnalysis}
  aria-label="Start vulnerability analysis"
  aria-disabled={running}
>
  {running ? 'Analyzing...' : 'Analyze'}
</button>
```

### 5.2 Keyboard Navigation

- All buttons focusable via Tab
- Enter/Space to activate
- Escape to close modals
- Arrow keys for dropdown navigation

### 5.3 Screen Reader Support

```tsx
<div role="region" aria-label="Analysis Progress">
  <PipelineProgress steps={steps} />
</div>

<div role="status" aria-live="polite">
  {error && <p className="text-red-500">{error}</p>}
</div>
```

### 5.4 Color Contrast

- All text meets WCAG 2.1 AA (4.5:1 ratio)
- Critical severity uses both color AND icon (🔴)

---

## 6. Performance Optimizations

### 6.1 Code Splitting

**Vite Auto-Splitting:**
```typescript
// Vite automatically splits React components
import { lazy, Suspense } from 'react';

const MitreHeatmap = lazy(() => import('./components/MitreHeatmap'));

<Suspense fallback={<LoadingSpinner />}>
  <MitreHeatmap chains={report.chains} />
</Suspense>
```

### 6.2 Memoization

```typescript
import { useMemo } from 'react';

const expensiveChartData = useMemo(() => {
  return processChartData(report.stats.findings_by_severity);
}, [report.stats.findings_by_severity]);
```

### 6.3 Virtualization (Future)

For large finding lists (>100 items):
```typescript
import { FixedSizeList as List } from 'react-window';

<List
  height={600}
  itemCount={findings.length}
  itemSize={60}
>
  {({ index, style }) => (
    <div style={style}>
      <FindingRow finding={findings[index]} />
    </div>
  )}
</List>
```

---

## 7. Testing Strategy

### 7.1 Component Tests (Planned)

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TargetSelector from './TargetSelector';

test('renders target options', () => {
  render(<TargetSelector target="pygoat" setTarget={jest.fn()} />);
  expect(screen.getByText('pygoat')).toBeInTheDocument();
  expect(screen.getByText('juice-shop')).toBeInTheDocument();
});

test('calls setTarget when option clicked', async () => {
  const setTarget = jest.fn();
  render(<TargetSelector target="pygoat" setTarget={setTarget} />);
  
  await userEvent.click(screen.getByText('juice-shop'));
  expect(setTarget).toHaveBeenCalledWith('juice-shop');
});
```

### 7.2 Visual Regression Tests (Future)

- Chromatic or Percy integration
- Snapshot key UI states (loading, error, success)

---

**Document End**
