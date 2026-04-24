# SPEC 3: API Specification
## CLARA REST API & SSE Streaming Protocol

**Version:** 1.0  
**Last Updated:** April 23, 2026  
**Base URL:** `http://localhost:8000` (development)  
**Protocol:** HTTP/1.1 + Server-Sent Events (SSE)

---

## 1. API Overview

### 1.1 Endpoints Summary

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/targets` | List available scan targets | No |
| POST | `/analyze` | Start new vulnerability analysis | No |
| GET | `/analyze/{run_id}/stream` | Real-time progress via SSE | No |
| GET | `/analyze/{run_id}/result` | Get completed report (polling fallback) | No |
| POST | `/suggest-fix` | Generate AI remediation advice | No |

**Authentication:** None (v1.0 is single-user, no auth layer)

### 1.2 Content Types

- **Request**: `application/json` (except SSE stream)
- **Response**: `application/json`
- **SSE Stream**: `text/event-stream`

### 1.3 Error Response Format

All error responses follow this structure:

```json
{
  "detail": "Human-readable error message",
  "status_code": 400
}
```

**HTTP Status Codes:**
- `200` — Success
- `202` — Accepted (analysis in progress)
- `400` — Bad Request (invalid input)
- `404` — Not Found (unknown run_id or target)
- `422` — Unprocessable Entity (validation error)
- `429` — Too Many Requests (rate limit exceeded, future)
- `500` — Internal Server Error

---

## 2. Endpoint Specifications

### 2.1 GET /targets

**Description:** Retrieve list of available pre-configured vulnerability scan targets.

**Request:**
```http
GET /targets HTTP/1.1
Host: localhost:8000
```

**Response:** `200 OK`
```json
[
  {
    "id": "pygoat",
    "context": "Python/Django intentionally vulnerable web application (OWASP pygoat)",
    "stack": "Python 3.10 + Django 4.2 + SQLite",
    "tools": ["bandit", "zap", "osv"]
  },
  {
    "id": "juice-shop",
    "context": "Node.js/Angular intentionally vulnerable e-commerce application (OWASP Juice Shop)",
    "stack": "Node.js 18 + Express + Angular + SQLite",
    "tools": ["zap", "osv/npm"]
  },
  {
    "id": "impacket",
    "context": "Python library for network protocols (SMB, Kerberos, NTLM) — Impacket",
    "stack": "Python 3.x + ctypes + OpenSSL bindings",
    "tools": ["bandit", "osv"]
  }
]
```

**Response Schema:**
```typescript
type TargetInfo = {
  id: string;              // Unique target identifier
  context: string;         // Application description
  stack: string;           // Technology stack
  tools: string[];         // Security tools configured for this target
}
```

**Error Cases:**
- None (endpoint always succeeds)

---

### 2.2 POST /analyze

**Description:** Initiate a new security analysis job. Returns immediately with a `run_id` for tracking progress.

**Request:**
```http
POST /analyze HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{
  "target": "pygoat",
  "demo": false,
  "uploaded_files": null
}
```

**Request Schema:**
```typescript
type AnalyzeRequest = {
  target: string;                    // Required: "pygoat" | "juice-shop" | "impacket" | "custom"
  demo?: boolean;                    // Optional: Use cached results (default: false)
  uploaded_files?: UploadedFile[];   // Optional: Custom scan files (for "custom" target)
}

type UploadedFile = {
  name: string;       // Original filename (e.g., "bandit_report.json")
  content: string;    // Base64-encoded file content OR raw JSON string
  category: string;   // "sast" | "dast" | "oss"
}
```

**Response:** `200 OK`
```json
{
  "run_id": "a3f2b8c0-4d1e-4f9a-8b2c-1d3e4f5a6b7c"
}
```

**Response Schema:**
```typescript
type AnalyzeResponse = {
  run_id: string;    // UUID v4 for tracking this analysis
}
```

**Error Cases:**

**400 Bad Request** — Unknown target
```json
{
  "detail": "Unknown target 'invalid-target'",
  "status_code": 400
}
```

**422 Unprocessable Entity** — Missing required field
```json
{
  "detail": "Field 'target' is required",
  "status_code": 422
}
```

**Example Requests:**

*Standard analysis:*
```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"target": "pygoat", "demo": false}'
```

*Demo mode (instant cached results):*
```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"target": "juice-shop", "demo": true}'
```

*Custom file upload:*
```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "target": "custom",
    "demo": false,
    "uploaded_files": [
      {
        "name": "bandit.json",
        "content": "{\"results\": [...]}",
        "category": "sast"
      },
      {
        "name": "zap.json",
        "content": "{\"alerts\": [...]}",
        "category": "dast"
      }
    ]
  }'
```

---

### 2.3 GET /analyze/{run_id}/stream

**Description:** Server-Sent Events (SSE) stream providing real-time analysis progress updates.

**Request:**
```http
GET /analyze/a3f2b8c0-4d1e-4f9a-8b2c-1d3e4f5a6b7c/stream HTTP/1.1
Host: localhost:8000
Accept: text/event-stream
```

**Response:** `200 OK` (streaming)
```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no

data: {"type":"step_start","step":"ingest","label":"Ingesting scanner data","step_num":1,"total":6}

data: {"type":"step_complete","step":"ingest","result_summary":"120 findings loaded"}

data: {"type":"step_start","step":"dedup","label":"Deduplicating findings","step_num":2,"total":6}

data: {"type":"step_complete","step":"dedup","result_summary":"85 unique findings (35 duplicates removed)"}

data: {"type":"step_start","step":"cluster","label":"Clustering by attack surface","step_num":3,"total":6}

data: {"type":"step_complete","step":"cluster","result_summary":"5 clusters identified"}

data: {"type":"step_start","step":"synthesize","label":"Synthesizing attack chains","step_num":4,"total":6}

data: {"type":"chain_preview","chain_id":"CHAIN-01","name":"SQL Injection to Data Exfiltration","severity":"critical","narrative_preview":"1. Attacker identifies unvalidated input field in login form..."}

data: {"type":"chain_preview","chain_id":"CHAIN-02","name":"XSS to Session Hijacking","severity":"high","narrative_preview":"1. Attacker injects malicious script into comment field..."}

data: {"type":"step_complete","step":"synthesize","result_summary":"4 attack chains synthesized"}

data: {"type":"step_start","step":"mitre_prioritize","label":"Mapping MITRE ATT&CK + prioritizing","step_num":5,"total":6}

data: {"type":"step_complete","step":"mitre_prioritize","result_summary":"chains scored and ranked"}

data: {"type":"step_start","step":"report","label":"Generating report","step_num":6,"total":6}

data: {"type":"step_complete","step":"report","result_summary":"report complete"}

data: {"type":"complete","report":{...full_report_json...}}
```

**SSE Event Types:**

| Event Type | Fields | When Emitted |
|------------|--------|--------------|
| `step_start` | step, label, step_num, total | Pipeline node begins execution |
| `step_complete` | step, result_summary | Pipeline node finishes successfully |
| `chain_preview` | chain_id, name, severity, narrative_preview | Attack chain generated (during synthesize) |
| `complete` | report | Full analysis completed |
| `error` | step, message | Pipeline error occurred |

**Event Schemas:**

```typescript
type StepStartEvent = {
  type: "step_start";
  step: string;           // "ingest" | "dedup" | "cluster" | "synthesize" | "mitre_prioritize" | "report"
  label: string;          // Human-readable step description
  step_num: number;       // Current step index (1-indexed)
  total: number;          // Total number of steps (always 6)
}

type StepCompleteEvent = {
  type: "step_complete";
  step: string;
  result_summary: string; // Brief result description (e.g., "85 unique findings")
}

type ChainPreviewEvent = {
  type: "chain_preview";
  chain_id: string;       // "CHAIN-01", "CHAIN-02", etc.
  name: string;           // Attack chain name
  severity: "critical" | "high" | "medium" | "low";
  narrative_preview: string; // First 300 chars of narrative
}

type CompleteEvent = {
  type: "complete";
  report: Report;         // Full report object (see Report schema below)
}

type ErrorEvent = {
  type: "error";
  step?: string;          // Which step failed (or "unknown")
  message: string;        // Error description
}
```

**Client Example (JavaScript):**

```javascript
const eventSource = new EventSource('http://localhost:8000/analyze/a3f2b8c0.../stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'step_start':
      console.log(`Starting: ${data.label} (${data.step_num}/${data.total})`);
      break;
    
    case 'step_complete':
      console.log(`✓ ${data.step}: ${data.result_summary}`);
      break;
    
    case 'chain_preview':
      console.log(`Found chain: ${data.name} (${data.severity})`);
      break;
    
    case 'complete':
      console.log('Analysis complete!', data.report);
      eventSource.close();
      break;
    
    case 'error':
      console.error(`Error in ${data.step}: ${data.message}`);
      eventSource.close();
      break;
  }
};

eventSource.onerror = () => {
  console.error('SSE connection error');
  eventSource.close();
};
```

**Error Cases:**

**404 Not Found** — Unknown run_id
```
data: {"type":"error","message":"Run not found"}
```

**Connection Timeout:** Client should reconnect after 5 minutes

---

### 2.4 GET /analyze/{run_id}/result

**Description:** Polling-based endpoint to retrieve completed analysis report. Alternative to SSE streaming.

**Request:**
```http
GET /analyze/a3f2b8c0-4d1e-4f9a-8b2c-1d3e4f5a6b7c/result HTTP/1.1
Host: localhost:8000
```

**Response (Analysis Complete):** `200 OK`
```json
{
  "target": "pygoat",
  "executive_summary": "Analysis identified 85 unique vulnerabilities across 5 attack surfaces, synthesized into 4 critical attack chains. Primary risks include SQL injection enabling data exfiltration and XSS leading to session hijacking.",
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
      "narrative": "1. Attacker identifies unvalidated SQL query in login endpoint (views.py:45)\n2. Crafts UNION-based injection payload to extract user table schema\n3. Exfiltrates credentials via error-based SQL injection\n4. Uses stolen admin credentials to access sensitive customer data\n5. Exploits missing rate limiting to perform automated data dump",
      "business_impact": "Complete compromise of customer database (500K+ records). Regulatory fines under GDPR (Article 83). Reputational damage and loss of customer trust.",
      "finding_ids": ["pygoat-B001-015", "pygoat-ZAP-003", "pygoat-OSV-042"],
      "clusters_spanned": ["data_access", "authentication", "network_transport"],
      "mitre_techniques": [
        {
          "id": "T1190",
          "name": "Exploit Public-Facing Application",
          "tactic": "Initial Access"
        },
        {
          "id": "T1020",
          "name": "Automated Exfiltration",
          "tactic": "Exfiltration"
        }
      ],
      "blast_radius_notes": "Affects all user records in production database. No column-level encryption.",
      "locations": ["views.py:45", "models.py:23", "login.html"]
    }
    /* ...additional chains... */
  ],
  "findings": [
    {
      "id": "pygoat-B001-015",
      "title": "SQL Injection Possible",
      "severity": "high",
      "source_tool": "bandit",
      "location": "views.py:45",
      "cwe": ["CWE-89"],
      "cve": null
    }
    /* ...additional findings... */
  ]
}
```

**Response (Analysis In Progress):** `202 Accepted`
```json
{
  "detail": "Run status: running",
  "status_code": 202
}
```

**Response (Analysis Failed):** `202 Accepted`
```json
{
  "detail": "Run status: error",
  "status_code": 202
}
```

**Error Cases:**

**404 Not Found** — Unknown run_id
```json
{
  "detail": "Run not found",
  "status_code": 404
}
```

**Polling Strategy:**
```javascript
async function pollResult(runId) {
  const maxAttempts = 60;  // 5 minutes (5s intervals)
  
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`http://localhost:8000/analyze/${runId}/result`);
    
    if (response.status === 200) {
      return await response.json();  // Success
    } else if (response.status === 202) {
      await new Promise(resolve => setTimeout(resolve, 5000));  // Wait 5s
      continue;
    } else {
      throw new Error(`Polling failed: ${response.status}`);
    }
  }
  
  throw new Error('Analysis timeout after 5 minutes');
}
```

---

### 2.5 POST /suggest-fix

**Description:** Generate AI-powered remediation advice for a specific attack chain.

**Request:**
```http
POST /suggest-fix HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{
  "chain_name": "SQL Injection to Data Exfiltration",
  "severity": "critical",
  "narrative": "1. Attacker identifies unvalidated SQL query...\n2. Crafts UNION-based injection...",
  "business_impact": "Complete compromise of customer database",
  "locations": ["views.py:45", "models.py:23"]
}
```

**Request Schema:**
```typescript
type FixRequest = {
  chain_name: string;              // Required: Attack chain name
  severity: string;                // Required: "critical" | "high" | "medium" | "low"
  narrative: string;               // Required: Attack chain narrative
  business_impact?: string;        // Optional: Business impact description
  locations?: string[];            // Optional: Affected file locations
}
```

**Response:** `200 OK`
```json
{
  "suggestion": "### Immediate Actions:\n\n1. **Parameterize SQL Queries**: Replace string concatenation with Django ORM's `.filter()` or parameterized raw queries. Example:\n   ```python\n   # BEFORE (vulnerable)\n   query = f\"SELECT * FROM users WHERE username = '{user_input}'\"\n   cursor.execute(query)\n   \n   # AFTER (secure)\n   User.objects.filter(username=user_input)  # Django ORM\n   # OR for raw SQL:\n   cursor.execute(\"SELECT * FROM users WHERE username = %s\", [user_input])\n   ```\n\n2. **Input Validation**: Implement whitelist validation on all user inputs at views.py:45. Reject special characters (`'`, `\"`, `;`, `--`) in login fields.\n\n3. **WAF Rules**: Deploy ModSecurity or Cloudflare WAF with OWASP Core Rule Set (CRS) to block common SQLi patterns.\n\n4. **Database Permissions**: Use principle of least privilege — application DB user should have SELECT/INSERT only, no DROP/ALTER permissions.\n\n5. **Audit Logging**: Enable query logging to detect post-exploitation activity. Monitor for anomalous UNION/OR 1=1 patterns.\n\n**Long-Term**: Implement prepared statements across entire codebase. Schedule penetration test after remediation to verify fix effectiveness."
}
```

**Response Schema:**
```typescript
type FixResponse = {
  suggestion: string;  // Markdown-formatted remediation guide (3-5 actionable steps + code examples)
}
```

**Error Cases:**

**422 Unprocessable Entity** — Missing required field
```json
{
  "detail": "Field 'chain_name' is required",
  "status_code": 422
}
```

**500 Internal Server Error** — LLM API failure
```json
{
  "detail": "Failed to generate fix suggestion: API quota exhausted",
  "status_code": 500
}
```

**Example Request:**
```bash
curl -X POST http://localhost:8000/suggest-fix \
  -H "Content-Type: application/json" \
  -d '{
    "chain_name": "XSS to Session Hijacking",
    "severity": "high",
    "narrative": "1. Attacker injects script...\n2. Script steals cookies...",
    "business_impact": "Account takeover for all active users",
    "locations": ["templates/comment.html", "views.py:102"]
  }'
```

---

## 3. Data Schemas

### 3.1 Report Schema (Full)

```typescript
type Report = {
  target: string;                          // "pygoat" | "juice-shop" | "impacket"
  executive_summary: string;               // 2-3 sentence high-level overview
  stats: ReportStats;
  chains: Chain[];
  findings?: Finding[];                    // Optional: Full finding details for drill-down
}

type ReportStats = {
  total_findings: number;                  // Raw findings before deduplication
  duplicates_removed: number;              // Number of duplicate findings
  findings_by_severity: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    informational?: number;
  };
  findings_by_tool: {
    bandit?: number;
    zap?: number;
    "npm-audit"?: number;
    "osv-scanner"?: number;
  };
  total_chains: number;                    // Number of synthesized attack chains
}

type Chain = {
  id: string;                              // "CHAIN-01", "CHAIN-02", etc.
  name: string;                            // "SQL Injection to Data Exfiltration"
  severity: "critical" | "high" | "medium" | "low";
  fix_priority: number;                    // 1-10 scale (10 = highest urgency)
  confidence: number;                      // 0.0-1.0 (AI confidence score)
  narrative: string;                       // Numbered attack steps (markdown)
  business_impact: string;                 // Application-specific impact description
  finding_ids: string[];                   // References to raw findings
  clusters_spanned: string[];              // Attack surfaces involved
  mitre_techniques: MitreTechnique[];      // ATT&CK mappings
  blast_radius_notes: string;              // Scope of potential damage
  locations?: string[];                    // Optional: Affected files/packages
  finding_count?: number;                  // Optional: Number of findings in chain
}

type MitreTechnique = {
  id: string;                              // "T1190", "T1552.001", etc.
  name: string;                            // "Exploit Public-Facing Application"
  tactic: string;                          // "Initial Access", "Credential Access", etc.
}

type Finding = {
  id: string;                              // "{target}-{tool}-{index}" (e.g., "pygoat-B001-015")
  title: string;                           // Human-readable finding title
  severity: "critical" | "high" | "medium" | "low" | "informational";
  source_tool: "bandit" | "zap" | "npm-audit" | "osv-scanner";
  location: string;                        // "file.py:123" | "package@version" | "url:alert-name"
  cwe: string[];                           // ["CWE-89", "CWE-20"]
  cve: string | null;                      // "CVE-2024-1234" | "GHSA-xxxx-yyyy" | null
  description?: string;                    // Optional: Detailed description
  source_target?: string;                  // Optional: "pygoat" | "juice-shop" | "impacket"
}
```

---

## 4. Rate Limiting & Quotas

### 4.1 Current Limits (v1.0)

**No rate limiting implemented** — Single-user hackathon demo

### 4.2 Recommended Limits (Future)

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /analyze` | 10 requests | Per minute per IP |
| `POST /suggest-fix` | 20 requests | Per minute per IP |
| `GET /analyze/{run_id}/stream` | 5 concurrent connections | Per IP |
| `GET /targets` | 100 requests | Per minute (no critical impact) |

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1640995200
```

**Rate Limit Response:** `429 Too Many Requests`
```json
{
  "detail": "Rate limit exceeded. Try again in 42 seconds.",
  "status_code": 429
}
```

---

## 5. CORS Configuration

### 5.1 Current Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # Allow all origins (hackathon only!)
    allow_methods=["*"],           # GET, POST, OPTIONS
    allow_headers=["*"],           # Content-Type, Authorization, etc.
)
```

### 5.2 Production Configuration (Recommended)

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://clara-app.example.com",
        "https://staging.clara-app.example.com"
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    allow_credentials=False,       # No cookies/auth tokens
)
```

---

## 6. API Versioning

### 6.1 Current State

**No versioning** — All endpoints are v1 implicit

### 6.2 Future Versioning Strategy

**URL Versioning (Recommended):**
```
http://localhost:8000/v1/analyze
http://localhost:8000/v2/analyze
```

**Breaking Changes:**
- New major version (v1 → v2) for incompatible schema changes
- Maintain v1 for 6 months after v2 release
- Document migration guide

---

## 7. Webhooks (Future)

### 7.1 Analysis Completion Webhook

**Not Implemented (v1.0)**

**Proposed Design:**
```json
POST https://client-app.example.com/clara-webhook

{
  "event": "analysis.complete",
  "run_id": "a3f2b8c0...",
  "target": "pygoat",
  "timestamp": "2026-04-23T12:34:56Z",
  "report_url": "https://api.clara.example.com/analyze/a3f2b8c0.../result"
}
```

**Webhook Signature:**
```http
X-Clara-Signature: sha256=abc123...
```

Verify signature:
```python
import hmac
expected = hmac.new(webhook_secret, body, hashlib.sha256).hexdigest()
assert expected == request.headers['X-Clara-Signature']
```

---

## 8. SDK Examples

### 8.1 JavaScript/TypeScript Client

```typescript
class ClaraClient {
  constructor(private baseUrl: string = 'http://localhost:8000') {}
  
  async getTargets(): Promise<TargetInfo[]> {
    const response = await fetch(`${this.baseUrl}/targets`);
    return response.json();
  }
  
  async startAnalysis(request: AnalyzeRequest): Promise<string> {
    const response = await fetch(`${this.baseUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    const data = await response.json();
    return data.run_id;
  }
  
  streamAnalysis(runId: string, callbacks: {
    onStepStart?: (event: StepStartEvent) => void,
    onStepComplete?: (event: StepCompleteEvent) => void,
    onChainPreview?: (event: ChainPreviewEvent) => void,
    onComplete?: (report: Report) => void,
    onError?: (error: ErrorEvent) => void,
  }): EventSource {
    const eventSource = new EventSource(`${this.baseUrl}/analyze/${runId}/stream`);
    
    eventSource.onmessage = (e) => {
      const event = JSON.parse(e.data);
      
      switch (event.type) {
        case 'step_start':
          callbacks.onStepStart?.(event);
          break;
        case 'step_complete':
          callbacks.onStepComplete?.(event);
          break;
        case 'chain_preview':
          callbacks.onChainPreview?.(event);
          break;
        case 'complete':
          callbacks.onComplete?.(event.report);
          eventSource.close();
          break;
        case 'error':
          callbacks.onError?.(event);
          eventSource.close();
          break;
      }
    };
    
    return eventSource;
  }
  
  async getResult(runId: string): Promise<Report> {
    const response = await fetch(`${this.baseUrl}/analyze/${runId}/result`);
    if (response.status === 202) {
      throw new Error('Analysis still in progress');
    }
    return response.json();
  }
  
  async suggestFix(request: FixRequest): Promise<string> {
    const response = await fetch(`${this.baseUrl}/suggest-fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    const data = await response.json();
    return data.suggestion;
  }
}

// Usage
const clara = new ClaraClient();

const runId = await clara.startAnalysis({ target: 'pygoat', demo: false });

clara.streamAnalysis(runId, {
  onStepStart: (event) => console.log(`Starting: ${event.label}`),
  onStepComplete: (event) => console.log(`✓ ${event.result_summary}`),
  onComplete: (report) => console.log('Done!', report),
});
```

### 8.2 Python Client

```python
import requests
from typing import Dict, Iterator, Callable

class ClaraClient:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
    
    def get_targets(self) -> list[Dict]:
        response = requests.get(f"{self.base_url}/targets")
        response.raise_for_status()
        return response.json()
    
    def start_analysis(self, target: str, demo: bool = False) -> str:
        response = requests.post(
            f"{self.base_url}/analyze",
            json={"target": target, "demo": demo}
        )
        response.raise_for_status()
        return response.json()["run_id"]
    
    def stream_analysis(self, run_id: str, callback: Callable[[Dict], None]):
        """Stream analysis progress via SSE."""
        import sseclient  # pip install sseclient-py
        
        response = requests.get(
            f"{self.base_url}/analyze/{run_id}/stream",
            stream=True,
            headers={"Accept": "text/event-stream"}
        )
        
        client = sseclient.SSEClient(response)
        for event in client.events():
            if event.data:
                data = json.loads(event.data)
                callback(data)
                if data["type"] in ("complete", "error"):
                    break
    
    def get_result(self, run_id: str) -> Dict:
        response = requests.get(f"{self.base_url}/analyze/{run_id}/result")
        if response.status_code == 202:
            raise ValueError("Analysis still in progress")
        response.raise_for_status()
        return response.json()
    
    def suggest_fix(self, chain_name: str, severity: str, narrative: str) -> str:
        response = requests.post(
            f"{self.base_url}/suggest-fix",
            json={
                "chain_name": chain_name,
                "severity": severity,
                "narrative": narrative
            }
        )
        response.raise_for_status()
        return response.json()["suggestion"]

# Usage
clara = ClaraClient()

run_id = clara.start_analysis("pygoat", demo=False)

def on_event(event):
    if event["type"] == "step_complete":
        print(f"✓ {event['result_summary']}")
    elif event["type"] == "complete":
        print("Analysis complete!")

clara.stream_analysis(run_id, on_event)
```

---

## 9. Testing the API

### 9.1 Health Check (Informal)

```bash
# Verify backend is running
curl http://localhost:8000/targets
```

Expected output:
```json
[{"id":"pygoat",...}, {"id":"juice-shop",...}, {"id":"impacket",...}]
```

### 9.2 End-to-End Test Flow

```bash
# 1. List targets
curl http://localhost:8000/targets | jq '.[] | .id'

# 2. Start analysis
RUN_ID=$(curl -s -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"target":"pygoat","demo":true}' \
  | jq -r '.run_id')

echo "Run ID: $RUN_ID"

# 3. Stream progress (or use GET polling)
curl -N http://localhost:8000/analyze/$RUN_ID/stream

# 4. Get final result
curl http://localhost:8000/analyze/$RUN_ID/result | jq '.chains[0].name'

# 5. Suggest fix for first chain
CHAIN_NAME=$(curl -s http://localhost:8000/analyze/$RUN_ID/result | jq -r '.chains[0].name')
curl -X POST http://localhost:8000/suggest-fix \
  -H "Content-Type: application/json" \
  -d "{\"chain_name\":\"$CHAIN_NAME\",\"severity\":\"high\",\"narrative\":\"Test\"}" \
  | jq -r '.suggestion'
```

---

## 10. Changelog

### v1.0 (2026-04-23) — Initial Release

- ✅ GET `/targets` — List scan targets
- ✅ POST `/analyze` — Start analysis
- ✅ GET `/analyze/{run_id}/stream` — SSE progress
- ✅ GET `/analyze/{run_id}/result` — Polling fallback
- ✅ POST `/suggest-fix` — AI remediation advice
- ⚠️ No authentication, rate limiting, or webhooks (hackathon scope)

---

**Document End**
