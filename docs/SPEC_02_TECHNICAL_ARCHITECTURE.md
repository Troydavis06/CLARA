# SPEC 2: Technical Architecture Specification
## CLARA — System Architecture & Design

**Version:** 1.0  
**Last Updated:** April 23, 2026  
**Document Type:** Technical Architecture  
**Status:** Implemented

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLARA System                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐         ┌──────────────┐      ┌─────────────┐ │
│  │   Frontend   │  HTTP   │   Backend    │ LLM  │   Gemini    │ │
│  │ React + Vite ├────────►│   FastAPI    ├─────►│  API / VTX  │ │
│  │  Tailwind    │  SSE    │  LangGraph   │      │   Ollama    │ │
│  └──────────────┘◄────────┤   Pipeline   │      │    Groq     │ │
│                            └──────────────┘      └─────────────┘ │
│                                   │                               │
│                                   │ Read                          │
│                                   ▼                               │
│                            ┌──────────────┐                       │
│                            │  File System │                       │
│                            │  Data Files  │                       │
│                            │ (demo/*.json)│                       │
│                            └──────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Architecture Principles

1. **Stateless Design**: No persistent database, in-memory state only
2. **Event-Driven**: SSE streaming for real-time progress updates
3. **LLM-Agnostic**: Abstraction layer supports Gemini, Vertex AI, Ollama, Groq
4. **Offline-First Demo**: Pre-cached golden files for instant evaluation
5. **Single-Page Application**: React SPA for zero-latency navigation
6. **Fail-Fast Validation**: Input validation at every pipeline stage
7. **Graceful Degradation**: Retry logic with fallback LLM providers

---

## 2. Technology Stack

### 2.1 Frontend Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Framework** | React | 18.3.1 | UI component library |
| **Build Tool** | Vite | 6.0.3 | Fast dev server + bundler |
| **Language** | TypeScript | 5.7.2 | Type-safe development |
| **Styling** | Tailwind CSS | 3.4.17 | Utility-first CSS framework |
| **State Management** | React useState/useCallback | Built-in | Local state only (no Redux) |
| **HTTP Client** | Fetch API + EventSource | Native | REST + SSE streaming |
| **Package Manager** | npm | 10+ | Dependency management |

**Key Dependencies:**
- `react`, `react-dom` — Core React libraries
- `vite` — Lightning-fast dev server with HMR
- `tailwindcss`, `autoprefixer`, `postcss` — CSS toolchain
- `@vitejs/plugin-react` — Vite integration for React

**Frontend File Structure:**
```
frontend/
├── src/
│   ├── main.tsx              # App entry point
│   ├── App.tsx               # Root component (routing, state)
│   ├── index.css             # Tailwind directives + custom styles
│   └── components/
│       ├── TargetSelector.tsx       # Target template picker
│       ├── FileUpload.tsx           # Drag-drop upload interface
│       ├── PipelineProgress.tsx     # Analysis progress stepper
│       ├── StatsPanel.tsx           # Aggregate statistics
│       ├── SeverityChart.tsx        # Pie/bar chart visualization
│       ├── MitreHeatmap.tsx         # ATT&CK technique heatmap
│       ├── AttackChainCard.tsx      # Chain detail card
│       ├── KillChainFlow.tsx        # Attack flow diagram
│       └── CyberBackground.tsx      # Animated background
├── public/                    # Static assets
├── index.html                 # HTML template
├── package.json               # npm dependencies
├── tsconfig.json              # TypeScript config
├── vite.config.ts             # Vite build config
├── tailwind.config.js         # Tailwind theme config
└── postcss.config.js          # PostCSS plugins
```

---

### 2.2 Backend Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Framework** | FastAPI | 0.115+ | Async HTTP server |
| **ASGI Server** | Uvicorn | 0.30+ | Production ASGI server |
| **Workflow Engine** | LangGraph | 0.2+ | State machine for LLM pipeline |
| **LLM SDK** | google-generativeai | 0.8+ | Gemini API client |
| **Validation** | Pydantic | 2.0+ | Data validation & serialization |
| **Config** | python-dotenv | 1.0+ | Environment variable loading |
| **Alternative LLMs** | ollama, groq | 0.1+, 0.9+ | Local + fallback LLM support |
| **Language** | Python | 3.10+ | Core language |

**Backend File Structure:**
```
backend/
├── main.py                    # FastAPI application + routes
├── requirements.txt           # Python dependencies
├── .env.example               # Environment variable template
├── OLLAMA_SETUP.md            # Local LLM setup guide
├── VERTEX_AI_SETUP.md         # GCP Vertex AI config guide
└── pipeline/
    ├── __init__.py
    ├── config.py              # Target configs, constants, Finding schema
    ├── state.py               # PipelineState TypedDict
    ├── graph.py               # LangGraph StateGraph builder
    ├── llm_utils.py           # Unified LLM interface (Gemini/Ollama/Groq)
    ├── gemini_utils.py        # Gemini-specific streaming helpers
    └── nodes/
        ├── __init__.py
        ├── ingest.py          # Parse scanner JSON → normalized findings
        ├── dedup.py           # Remove duplicate findings
        ├── cluster.py         # Cluster by attack surface (LLM call 1)
        ├── synthesize.py      # Generate attack chains (LLM call 2)
        ├── mitre_prioritize.py # Map ATT&CK + score (LLM call 3)
        └── report.py          # Assemble final JSON report
```

---

### 2.3 LLM Integration Architecture

**Supported Providers:**

| Provider | Use Case | Configuration | Cost |
|----------|----------|---------------|------|
| **Gemini API** | Primary (fastest) | `GEMINI_API_KEY` or `VERTEX_API_KEY` | $0.075/1M tokens (Flash) |
| **Vertex AI** | GCP enterprise | `VERTEX_PROJECT_ID`, `VERTEX_LOCATION` | Same as Gemini, billed to GCP project |
| **Ollama** | Local/offline | `ollama serve`, `OLLAMA_MODEL=llama3.2` | Free (local compute) |
| **Groq** | Fast fallback | `GROQ_API_KEY` | $0.05/1M tokens (llama-3.3-70b) |

**Provider Selection Logic:**
```python
def get_llm_provider():
    provider = os.environ.get("LLM_PROVIDER", "gemini")
    if provider == "ollama":
        return OllamaClient()
    elif provider == "gemini":
        if os.environ.get("VERTEX_PROJECT_ID"):
            return VertexAIClient()
        else:
            return GeminiAPIClient()
    return GeminiAPIClient()  # default
```

**Retry & Fallback Strategy:**
1. Primary LLM call (Gemini/Vertex/Ollama)
2. If rate limit error → wait 10s, retry
3. If quota exhausted → fallback to Groq (4 API keys with round-robin)
4. If validation error → retry with error feedback in prompt (max 2 retries)
5. If terminal failure → return error state, halt pipeline

---

## 3. Data Architecture

### 3.1 Data Flow Diagram

```
Scanner JSON Files
       ↓
┌──────────────────┐
│  1. INGEST       │  Parse JSON → Finding[]
│  (Pure Python)   │  Normalize severity, extract CWE/CVE
└────────┬─────────┘
         ↓
┌──────────────────┐
│  2. DEDUP        │  Hash-based deduplication
│  (Pure Python)   │  Remove exact duplicates
└────────┬─────────┘
         ↓
┌──────────────────┐
│  3. CLUSTER      │  LLM Call 1: Assign findings to attack surfaces
│  (Gemini LLM)    │  Output: {surface: [finding_ids]}
└────────┬─────────┘
         ↓
┌──────────────────┐
│  4. SYNTHESIZE   │  LLM Call 2: Generate attack chains
│  (Gemini LLM)    │  Output: [{name, narrative, finding_ids, severity}]
└────────┬─────────┘
         ↓
┌──────────────────┐
│  5. MITRE MAP    │  LLM Call 3: Map ATT&CK + prioritize
│  (Gemini LLM)    │  Output: [{...chain, mitre_techniques, fix_priority}]
└────────┬─────────┘
         ↓
┌──────────────────┐
│  6. REPORT       │  Assemble final JSON
│  (Pure Python)   │  Add executive summary, stats
└────────┬─────────┘
         ↓
    JSON Report
```

### 3.2 Core Data Models

#### Finding (Input Schema)
```python
@dataclass
class Finding:
    id: str                     # Unique ID: "{target}-{tool}-{index}"
    source_tool: str            # "bandit" | "zap" | "npm-audit" | "osv-scanner"
    source_target: str          # "pygoat" | "juice-shop" | "impacket"
    title: str                  # Human-readable finding title
    description: str            # Detailed description (may include code snippet)
    severity: str               # "critical" | "high" | "medium" | "low" | "informational"
    location: str               # "file.py:123" | "package@version" | "url:alert-name"
    cwe: list[str]              # ["CWE-89", "CWE-20"]
    cve: str | None             # "CVE-2024-1234" | None
```

#### PipelineState (LangGraph State)
```python
class PipelineState(TypedDict, total=False):
    # Configuration
    target: str                          # "pygoat" | "juice-shop" | "impacket"
    target_config: dict                  # Stack, threat model, file paths
    
    # Pipeline data (evolves through nodes)
    raw_data: dict                       # {sast: [...], dast: [...], oss: [...]}
    normalized_findings: list[dict]      # Output of ingest
    deduped_findings: list[dict]         # Output of dedup
    dedup_stats: dict                    # {raw, duplicates_removed, unique}
    clusters: dict                       # {surface: {finding_ids: [], count: int}}
    chains: list[dict]                   # Output of synthesize
    scored_chains: list[dict]            # Output of mitre_prioritize
    report: dict                         # Final report (output of report node)
    
    # Error handling
    error: str | None                    # Error message if any step fails
    retry_count: int                     # Number of retries attempted
    current_step: str                    # Current pipeline stage (for SSE events)
```

#### Report (Output Schema)
```json
{
  "target": "pygoat",
  "executive_summary": "2-3 sentence overview",
  "stats": {
    "total_findings": 120,
    "duplicates_removed": 35,
    "findings_by_severity": {
      "critical": 5,
      "high": 20,
      "medium": 40,
      "low": 20
    },
    "findings_by_tool": {
      "bandit": 21,
      "zap": 17,
      "osv-scanner": 82
    },
    "total_chains": 4
  },
  "chains": [
    {
      "id": "CHAIN-01",
      "name": "SQL Injection to Data Exfiltration",
      "severity": "critical",
      "fix_priority": 9,
      "confidence": 0.95,
      "narrative": "1. Step one\n2. Step two\n...",
      "business_impact": "Complete customer data breach, GDPR violation",
      "finding_ids": ["pygoat-B001", "pygoat-ZAP-003"],
      "clusters_spanned": ["data_access", "network_transport"],
      "mitre_techniques": [
        {"id": "T1190", "name": "Exploit Public-Facing Application", "tactic": "Initial Access"},
        {"id": "T1020", "name": "Automated Exfiltration", "tactic": "Exfiltration"}
      ],
      "blast_radius_notes": "Affects all user records in database",
      "locations": ["views.py:45", "login.html"]
    }
  ],
  "findings": [ /* optional raw finding list */ ]
}
```

#### Attack Surface Taxonomy
```python
VALID_SURFACES = {
    "authentication",        # Weak auth, hardcoded creds, JWT issues
    "data_access",          # SQL/NoSQL injection, ORM vulnerabilities
    "dependency_chain",     # OSS CVEs, supply chain, command injection
    "network_transport",    # CORS, CSP, XSS, SSL/TLS misconfig
    "file_system",          # Path traversal, file disclosure
    "session_management",   # CSRF, session fixation, cookie security
    "admin_interface"       # Debug mode, admin routes, error disclosure
}
```

---

## 4. Component Architecture

### 4.1 Frontend Component Hierarchy

```
App.tsx (Root State)
├── State: target, demo, running, steps, cachedReports, error, uploadedFiles
├── API Calls: runAnalysis(), stopAnalysis(), exportReport()
└── Child Components:
    ├── TargetSelector.tsx
    │   └── Props: target, setTarget, demo, setDemo
    ├── FileUpload.tsx
    │   └── Props: onFilesSelected
    ├── PipelineProgress.tsx
    │   └── Props: steps (StepEvent[])
    ├── StatsPanel.tsx
    │   └── Props: report.stats
    ├── SeverityChart.tsx
    │   └── Props: report.stats.findings_by_severity
    ├── MitreHeatmap.tsx
    │   └── Props: report.chains (extract techniques)
    ├── KillChainFlow.tsx
    │   └── Props: report.chains
    └── AttackChainCard.tsx (repeated)
        └── Props: chain, onSuggestFix
```

**Component Responsibilities:**

| Component | Input Props | State | Output Events |
|-----------|-------------|-------|---------------|
| **TargetSelector** | target, setTarget, demo, setDemo | None (controlled) | onChange → setTarget |
| **FileUpload** | onFilesSelected | dragActive, files | onFilesSelected(files) |
| **PipelineProgress** | steps: StepEvent[] | None | None (pure display) |
| **StatsPanel** | stats: ReportStats | None | None |
| **SeverityChart** | findings_by_severity | None | None (D3/recharts) |
| **MitreHeatmap** | chains: Chain[] | selectedTechnique | onClick → filter chains |
| **AttackChainCard** | chain: Chain | expanded, showFix | onExpand, onSuggestFix |

---

### 4.2 Backend API Layer

**FastAPI Application Structure:**

```python
# main.py
app = FastAPI(title="CLARA API")
app.add_middleware(CORSMiddleware, allow_origins=["*"])

# Global in-memory run store
_runs: dict[str, dict] = {}

# Routes
@app.get("/targets")                        # List available templates
@app.post("/analyze")                       # Start analysis, return run_id
@app.get("/analyze/{run_id}/stream")        # SSE progress stream
@app.get("/analyze/{run_id}/result")        # Get completed report
@app.post("/suggest-fix")                   # LLM fix suggestion
```

**Request/Response Models:**

```python
# Request schemas
class AnalyzeRequest(BaseModel):
    target: str                              # Required
    demo: bool = False                       # Optional, default False
    uploaded_files: list[dict] | None = None # Custom upload mode

class FixRequest(BaseModel):
    chain_name: str
    severity: str
    narrative: str
    business_impact: str | None = None
    locations: list[str] | None = None

# Response schemas
# GET /targets → list[TargetInfo]
TargetInfo = {
    "id": "pygoat",
    "context": "Python/Django intentionally vulnerable web app",
    "stack": "Python 3.10 + Django 4.2",
    "tools": ["bandit", "zap", "osv"]
}

# POST /analyze → {"run_id": "uuid-here"}

# SSE events → StepEvent
StepEvent = {
    "type": "step_start" | "step_complete" | "chain_preview" | "complete" | "error",
    "step": "ingest",
    "label": "Ingesting scanner data",
    "step_num": 1,
    "total": 6,
    "result_summary": "120 findings loaded",
    "report": {...}  # only in "complete" event
}
```

---

### 4.3 LangGraph Pipeline Architecture

**StateGraph Node Design:**

Each node is a pure function: `(state: PipelineState) -> PipelineState`

```python
# graph.py
def build_graph() -> StateGraph:
    g = StateGraph(PipelineState)
    
    # Add nodes
    g.add_node("ingest", ingest.run)
    g.add_node("dedup", dedup.run)
    g.add_node("cluster", cluster.run)
    g.add_node("synthesize", synthesize.run)
    g.add_node("mitre_prioritize", mitre_prioritize.run)
    g.add_node("report", report.run)
    g.add_node("error_terminal", lambda s: s)
    
    # Define edges
    g.set_entry_point("ingest")
    g.add_edge("ingest", "dedup")
    g.add_edge("dedup", "cluster")
    g.add_conditional_edges("cluster", _error_or_next("synthesize"))
    g.add_conditional_edges("synthesize", _error_or_next("mitre_prioritize"))
    g.add_edge("mitre_prioritize", "report")
    g.add_edge("report", END)
    
    return g.compile()
```

**Node Execution Model:**

1. **Ingest Node** (Pure Python)
   - Input: target, target_config
   - Process: Read JSON files, parse scanner-specific formats
   - Output: normalized_findings (list[Finding])
   - No LLM calls, no external I/O except file reads

2. **Dedup Node** (Pure Python)
   - Input: normalized_findings
   - Process: SHA1 hash of (title + severity + location)
   - Output: deduped_findings, dedup_stats
   - No LLM calls

3. **Cluster Node** (LLM Call 1)
   - Input: deduped_findings
   - Process: Gemini call with clustering prompt
   - Output: clusters (dict mapping surface → finding_ids)
   - Validation: All finding IDs assigned, no duplicates
   - Retry on validation failure (max 2 attempts)

4. **Synthesize Node** (LLM Call 2)
   - Input: deduped_findings, clusters, target_config
   - Process: Gemini call with attack chain synthesis prompt
   - Output: chains (list of attack chain objects)
   - Validation: 2-5 chains, each spans ≥2 surfaces, ≥3 steps in narrative
   - Retry on validation failure

5. **MITRE Prioritize Node** (LLM Call 3)
   - Input: chains, deduped_findings
   - Process: Gemini call for ATT&CK mapping + scoring
   - Output: scored_chains (chains + mitre_techniques + fix_priority)
   - Validation: All chains have ≥1 technique, priority in 1-10

6. **Report Node** (Pure Python)
   - Input: scored_chains, dedup_stats, normalized_findings
   - Process: Assemble final report JSON
   - Output: report (complete Report schema)
   - No LLM calls

**Error Handling Flow:**

```python
def _error_or_next(next_node: str):
    def router(state: PipelineState) -> str:
        if state.get("error"):
            return "error_terminal"  # Halt pipeline
        return next_node
    return router
```

---

## 5. LLM Prompt Engineering

### 5.1 System Prompt (All Nodes)

```
You are CLARA, a security analysis engine. Respond with valid JSON only.
RULES:
- Never invent CVE/GHSA identifiers.
- Never invent MITRE ATT&CK technique IDs.
- Severity values: critical | high | medium | low | informational (lowercase only).
- If inputs are empty, return the schema with empty arrays and a warnings[] entry.
```

### 5.2 Cluster Node Prompt Template

```
## Task: CLUSTER SECURITY FINDINGS

You must assign EVERY finding ID listed below to exactly one attack surface category.

ATTACK SURFACE RULES:
- SQL injection, database queries → data_access
- Hardcoded passwords, weak auth tokens → authentication
- Weak crypto (MD5/DES) for passwords/tokens → authentication
- npm/pip/OSS CVEs, library vulnerabilities → dependency_chain
- CORS, CSP, missing security headers, XSS → network_transport
- Session cookies, CSRF → session_management
- File disclosure, path traversal, backup files → file_system
- Admin routes, debug mode, error disclosure → admin_interface
- subprocess shell=True, command injection → dependency_chain

FINDINGS TO ASSIGN (you must place every ID into a cluster):
{findings_json}

INSTRUCTIONS:
1. Read each finding's title and CWE.
2. Assign its "id" field to exactly one surface.
3. Every single finding ID must appear in exactly one cluster's finding_ids list.
4. Do NOT leave any cluster arrays empty if findings belong there.
5. total_assigned MUST equal the total number of findings above.

Return ONLY valid JSON in this exact format (fill in real IDs, not zeros):
{
  "clusters": {
    "authentication": {"finding_ids": ["id1", "id2"], "count": 2},
    "data_access": {"finding_ids": [], "count": 0},
    ...
  },
  "total_assigned": 0,
  "warnings": []
}
```

**Validation Logic:**
```python
def _validate(result: dict, expected_count: int) -> str | None:
    clusters = result.get("clusters", {})
    all_ids = []
    for surface, data in clusters.items():
        if surface not in VALID_SURFACES:
            return f"Invalid surface key: {surface}"
        all_ids.extend(data.get("finding_ids", []))
    if len(all_ids) != expected_count:
        return f"total_assigned {len(all_ids)} != expected {expected_count}"
    if len(set(all_ids)) != len(all_ids):
        return "Duplicate finding_id detected across clusters"
    return None
```

---

### 5.3 Synthesize Node Prompt Template

```
## Task: SYNTHESIZE ATTACK CHAINS

Target: {target}
Stack: {stack}
Threat Model: {threat_model}

Construct 3-5 named attack chains from the clustered findings below.

Rules:
- Each chain MUST span findings from at least 2 different attack surfaces.
- Use a numbered step-by-step attacker narrative (min 3 steps, max 8 steps).
- Reference the target's specific stack and threat model to make the narrative concrete.
- Business impact must be specific to this application (not generic boilerplate).
- A finding may appear in multiple chains if genuinely relevant.
- Chain severity = highest severity among its constituent findings.
- Chain name should be evocative and technically accurate (e.g. "Token Forgery to Account Takeover").

Return ONLY this JSON schema:
{
  "chains": [
    {
      "id": "CHAIN-01",
      "name": "string",
      "narrative": "1. Step one\n2. Step two\n3. Step three",
      "business_impact": "string",
      "finding_ids": ["string"],
      "clusters_spanned": ["string"],
      "severity": "critical|high|medium|low",
      "finding_count": 0
    }
  ],
  "chain_count": 0,
  "warnings": []
}

CLUSTERS AND FINDINGS:
{clusters_with_findings_json}
```

**Validation Logic:**
```python
def _validate(chains: list[dict], finding_ids_set: set[str]) -> str | None:
    if not (2 <= len(chains) <= 5):
        return f"Expected 2-5 chains, got {len(chains)}"
    for c in chains:
        if len(c.get("clusters_spanned", [])) < 2:
            return f"Chain '{c.get('name')}' spans fewer than 2 clusters"
        for fid in c.get("finding_ids", []):
            if fid not in finding_ids_set:
                return f"Unknown finding_id '{fid}' in chain '{c.get('name')}'"
        steps = c.get("narrative", "").strip().splitlines()
        if len(steps) < 3:
            return f"Chain '{c.get('name')}' narrative has fewer than 3 steps"
    return None
```

---

### 5.4 MITRE Prioritize Node Prompt Template

```
## Task: MAP MITRE ATT&CK TECHNIQUES AND PRIORITIZE ATTACK CHAINS

For each attack chain below:
1. Map to 1-3 relevant MITRE ATT&CK techniques (use REAL technique IDs only)
2. Calculate fix_priority score (1-10 scale):
   - Severity weight: critical=10, high=7, medium=4, low=2
   - Exploitability: +1 if CVE exists, +1 if common attack pattern
   - Blast radius: +1 per finding in chain (max +3)
   - Confidence: multiply final score by confidence (0.7-1.0)
3. Add blast_radius_notes explaining impact scope

ATTACK CHAINS:
{chains_json}

MITRE MAPPING REFERENCE:
- SQL Injection → T1190 (Exploit Public-Facing Application)
- Hardcoded credentials → T1552.001 (Credentials in Files)
- XSS → T1059.007 (JavaScript)
- CSRF → T1185 (Browser Session Hijacking)
- Command injection → T1059.004 (Unix Shell)
- Supply chain CVE → T1195.002 (Compromise Software Supply Chain)

Return JSON:
{
  "chains": [
    {
      ...existing_chain_fields,
      "mitre_techniques": [
        {"id": "T1190", "name": "Exploit Public-Facing Application", "tactic": "Initial Access"}
      ],
      "fix_priority": 8,
      "confidence": 0.9,
      "blast_radius_notes": "Affects all user sessions"
    }
  ]
}
```

---

## 6. Infrastructure & Deployment

### 6.1 Development Environment

**Requirements:**
- Python 3.10+ (backend)
- Node.js 18+ (frontend build)
- Git (version control)
- Windows/macOS/Linux (cross-platform)

**Setup Commands:**
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: add GEMINI_API_KEY
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

### 6.2 Environment Variables

**Backend (.env):**
```bash
# LLM Configuration
LLM_PROVIDER=gemini              # gemini | ollama
GEMINI_MODEL=gemini-2.0-flash-exp
GEMINI_API_KEY=AIzaSy...         # From Google AI Studio

# Vertex AI (optional, alternative to GEMINI_API_KEY)
VERTEX_PROJECT_ID=my-gcp-project
VERTEX_LOCATION=us-central1
VERTEX_API_KEY=AIzaSy...

# Ollama (local LLM alternative)
OLLAMA_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434

# Groq (fallback)
GROQ_API_KEY=gsk_...
GROQ_API_KEY_PRAT=gsk_...        # Additional keys for rate limit mitigation
GROQ_API_KEY_SRI=gsk_...
GROQ_API_KEY_NIKHIL=gsk_...
```

**Frontend (.env):**
```bash
VITE_API_URL=http://localhost:8000   # Backend API URL
```

### 6.3 Production Deployment Considerations

**Not Implemented (v1.0 is dev-only):**
- HTTPS/TLS termination
- Domain hosting
- Database persistence
- User authentication
- Load balancing
- Containerization (Docker)

**Future Deployment Stack (Recommendations):**
- **Frontend**: Vercel / Netlify (static hosting)
- **Backend**: Google Cloud Run (containerized FastAPI)
- **LLM**: Vertex AI (GCP project billing)
- **Database**: PostgreSQL on Cloud SQL (if adding persistence)
- **Monitoring**: Google Cloud Logging + Error Reporting

---

## 7. Security Architecture

### 7.1 Threat Model

**Assets:**
- API keys (Gemini, Groq)
- Uploaded vulnerability scan data (may contain sensitive paths/package names)
- Generated reports (may reveal internal architecture)

**Threats:**
1. **API Key Exposure**: Keys committed to git → Supply chain attack
2. **Data Leakage**: Uploaded scan data persisted → Privacy violation
3. **Prompt Injection**: Malicious content in scan data → LLM manipulation
4. **Denial of Service**: Unlimited API calls → Cost exhaustion
5. **XSS Injection**: Malicious strings in scan data → Frontend XSS

### 7.2 Security Controls

| Threat | Mitigation | Status |
|--------|-----------|--------|
| API Key Exposure | `.env` files in `.gitignore`, never hardcoded | ✅ Implemented |
| Data Leakage | No persistent storage, in-memory state only | ✅ Implemented |
| Prompt Injection | Input validation, JSON schema enforcement | ✅ Implemented |
| DoS / Cost Exhaustion | Rate limiting (planned), API key rotation | ⚠️ Planned |
| XSS | React auto-escaping, no `dangerouslySetInnerHTML` | ✅ Implemented |
| CORS Abuse | Restrict origins in production | ⚠️ Currently `allow_origins=["*"]` |

### 7.3 Data Privacy

**Privacy by Design:**
- No user accounts, no PII collection
- Uploaded files processed in-memory only
- No logging of scan data contents
- No telemetry or analytics
- Demo mode uses publicly available OWASP projects (Juice Shop, pygoat)

**GDPR Compliance:**
Not applicable (no personal data processing)

---

## 8. Performance & Scalability

### 8.1 Performance Benchmarks

| Metric | Target | Actual (Gemini) | Actual (Ollama CPU) |
|--------|--------|-----------------|---------------------|
| Ingestion (100 findings) | <5s | ~2s | ~2s |
| Full Analysis (100 findings) | <30s | ~25s | ~90s |
| Demo Mode Load | <2s | ~1.5s | ~1.5s |
| Frontend Initial Load | <2s | ~1.8s | N/A |
| SSE Event Latency | <200ms | ~150ms | N/A |

**Bottlenecks:**
1. **LLM API latency**: 3-8 seconds per Gemini call (3 calls total)
2. **Network I/O**: Frontend SSE reconnect on temporary disconnect
3. **JSON parsing**: Large scan files (>10MB) take 1-2 seconds to parse

### 8.2 Scalability Limits (v1.0)

**Single-Instance Capacity:**
- Max concurrent analyses: 5 (in-memory state isolation)
- Max findings per analysis: 1000 (Gemini context limit ~1M tokens)
- Max file upload size: 50MB (configurable in FastAPI)
- Max SSE connections: 50 (Uvicorn default worker count)

**Horizontal Scaling (Not Implemented):**
- Backend is stateless → can run multiple Uvicorn workers
- Frontend is static → CDN distribution ready
- No shared state database → need Redis for multi-instance coordination

---

## 9. Testing Strategy

### 9.1 Testing Pyramid

```
           ┌─────────────┐
           │   Manual    │  Hackathon demo testing
           │ Integration │  (targets: pygoat, juice-shop, impacket)
           └─────────────┘
          ┌───────────────┐
          │  Unit Tests   │  Pipeline node validation logic
          │  (Planned)    │  LLM response parsing
          └───────────────┘
```

**Current State:** Manual testing only (no automated test suite)

### 9.2 Manual Test Scenarios

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| **Happy Path** | Select pygoat → Analyze → Wait 30s | 3-5 chains, MITRE heatmap, severity chart |
| **Demo Mode** | Toggle demo → Select juice-shop → Analyze | Instant results (<2s) |
| **Custom Upload** | Upload tab → Drop 3 JSON files → Analyze | Custom target analysis |
| **Error Handling** | Invalid JSON upload | Clear error message "Invalid JSON format" |
| **Stop Analysis** | Start analysis → Click stop button | SSE closed, error message displayed |

### 9.3 Future Testing (Planned)

```python
# Example unit test structure
def test_ingest_bandit():
    state = {"target": "pygoat", "target_config": TARGETS["pygoat"]}
    result = ingest.run(state)
    assert len(result["normalized_findings"]) > 0
    assert all(f["severity"] in SEVERITY_ORDER for f in result["normalized_findings"])

def test_dedup_removes_duplicates():
    findings = [
        {"id": "1", "title": "SQL Injection", "severity": "high", "location": "app.py:10"},
        {"id": "2", "title": "SQL Injection", "severity": "high", "location": "app.py:10"},
    ]
    state = {"normalized_findings": findings}
    result = dedup.run(state)
    assert len(result["deduped_findings"]) == 1
    assert result["dedup_stats"]["duplicates_removed"] == 1
```

---

## 10. Monitoring & Observability

### 10.1 Logging

**Current Implementation:**
```python
import logging
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("clara.llm")

# Example log entries
log.info(f"→ Gemini request  model={model}  prompt_chars={len(prompt)}")
log.info(f"✓ Gemini OK  elapsed={elapsed:.1f}s  response_chars={len(result)}")
log.warning(f"⚠ Rate limit hit, retrying in 10s...")
log.error(f"✗ LLM error: {error_message}")
```

**Log Output (Uvicorn Console):**
```
12:34:56 [INFO] clara.llm: → Gemini request  model=gemini-2.0-flash  prompt_chars=3420
12:35:02 [INFO] clara.llm: ✓ Gemini OK  elapsed=6.2s  response_chars=1850
12:35:02 [INFO] uvicorn.access: 127.0.0.1:52341 - "GET /analyze/abc123/stream HTTP/1.1" 200
```

### 10.2 Error Tracking

**Current State:** Console logs only (no Sentry, no structured logging)

**Error Categories:**
1. **LLM Errors**: Rate limit, quota exhausted, invalid API key
2. **Validation Errors**: JSON parsing failure, missing finding IDs
3. **File Errors**: Invalid upload, missing data files
4. **Network Errors**: SSE disconnect, timeout

### 10.3 Metrics (Not Implemented)

**Recommended Future Metrics:**
- Analysis success rate (completed / started)
- Average analysis duration by target
- LLM token usage (input + output)
- API cost per analysis
- Retry rate per node

---

## 11. Development Workflow

### 11.1 Git Workflow

**Branch Strategy:**
- `main` — Production-ready code
- Feature branches — `feature/attack-chain-visualization`, `fix/gemini-retry-logic`

**Commit Convention:**
```
feat: Add MITRE heatmap visualization
fix: Handle missing CWE gracefully in ingest
docs: Update VERTEX_AI_SETUP guide
refactor: Extract LLM retry logic to llm_utils
```

### 11.2 Code Quality

**Python:**
- Type hints enforced (mypy planned)
- Black formatter (not yet configured)
- Flake8 linter (not yet configured)
- Docstrings on public functions

**TypeScript:**
- ESLint configured (via Vite)
- Prettier (not yet configured)
- Strict mode enabled (`tsconfig.json`)

### 11.3 Dependency Management

**Backend:**
```bash
# Add new dependency
pip install new-package
pip freeze > requirements.txt

# Upgrade dependencies
pip install --upgrade -r requirements.txt
```

**Frontend:**
```bash
# Add new dependency
npm install new-package
npm audit fix  # Security updates
```

---

## 12. Architecture Decision Records (ADRs)

### ADR-001: Use LangGraph for Pipeline Orchestration

**Decision:** Use LangGraph instead of custom async/await chains  
**Rationale:**
- Built-in state management across nodes
- Native retry/error handling
- Stream mode for SSE integration
- Better testability (each node is pure function)

**Alternatives Considered:**
- Plain async functions with manual state passing
- Prefect/Dagster (too heavyweight)

---

### ADR-002: No Database Persistence

**Decision:** In-memory state only, no PostgreSQL/MongoDB  
**Rationale:**
- Hackathon time constraint (48 hours)
- Simplifies deployment (no DB setup)
- Privacy by design (no scan data retention)
- Sufficient for single-user demo

**Tradeoffs:**
- No analysis history
- No multi-user support
- State lost on server restart

---

### ADR-003: Gemini as Primary LLM

**Decision:** Google Gemini 2.0 Flash as default LLM  
**Rationale:**
- Fast (3-8s per call vs 60s+ for local LLMs)
- High accuracy on JSON generation
- Free tier + $50 budget sufficient for hackathon
- Vertex AI option for enterprise users

**Alternatives Considered:**
- GPT-4 (more expensive, slower)
- Claude 3.5 (no streaming SDK at time)
- Local Llama (too slow on CPU)

---

### ADR-004: SSE Over WebSockets

**Decision:** Server-Sent Events (SSE) for progress streaming  
**Rationale:**
- Simpler than WebSocket (unidirectional)
- Native browser EventSource API
- Works with Uvicorn/FastAPI out of box
- Auto-reconnect on disconnect

**Tradeoffs:**
- Cannot stop analysis from client (HTTP DELETE endpoint needed)

---

### ADR-005: Tailwind CSS Over Component Library

**Decision:** Tailwind CSS instead of Material-UI/Chakra  
**Rationale:**
- Faster iteration (no prop learning curve)
- Smaller bundle size
- Full design control (per frontend-design-skill requirements)
- No dependency bloat

**Tradeoffs:**
- More verbose JSX
- No pre-built accessible components

---

## 13. Future Architecture Improvements

### 13.1 Phase 2 Enhancements (Q3 2026)

1. **Database Layer**
   - PostgreSQL for analysis history
   - Schema: `analyses`, `reports`, `findings`, `chains`
   - Alembic migrations

2. **Authentication**
   - OAuth2 + JWT tokens
   - User model: `users`, `workspaces`
   - RBAC: admin, analyst, viewer roles

3. **Caching**
   - Redis for LLM response caching (dedupe identical prompts)
   - Cache key: SHA256(prompt + model + temperature)

4. **Queueing**
   - Celery for async analysis processing
   - RabbitMQ/Redis as broker
   - Webhook notifications on completion

### 13.2 Advanced LLM Features

1. **Confidence Calibration**
   - Track validation failure rate per node
   - Adjust temperature/retries based on history

2. **Few-Shot Prompt Engineering**
   - Include 1-2 example chains in synthesize prompt
   - Improves narrative quality

3. **Chain-of-Thought Reasoning**
   - Explicit reasoning step before JSON output
   - Reduce hallucinated technique IDs

---

**Document End**
