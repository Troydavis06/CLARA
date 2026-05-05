# SPEC 1: Product Requirements Document (PRD)
## CLARA — Contextual Layered Analysis for Risk & Remediation

**Version:** 1.0  
**Last Updated:** April 23, 2026  
**Status:** Working MVP (Hook'em Hacks 2026)  
**Product Owner:** Development Team

---

## 1. Executive Summary

### 1.1 Product Vision
CLARA is an AI-powered security analysis platform that transforms fragmented vulnerability scan data from multiple security tools into unified, actionable intelligence. It synthesizes findings from SAST, DAST, and OSS scanners into prioritized attack chains mapped to the MITRE ATT&CK framework.

### 1.2 Problem Statement
Modern software development teams face critical challenges in vulnerability management:
- **Tool Fragmentation**: Security teams use 3-5 different scanning tools (Bandit, ZAP, npm audit, OSV scanner), each generating isolated reports
- **Data Overload**: A typical scan produces 50-500 findings, many duplicates or false positives
- **No Prioritization**: All findings appear equally urgent, creating analysis paralysis
- **Missing Context**: Tools report technical vulnerabilities but fail to explain business impact or attack feasibility
- **Manual Triage**: Security engineers spend 60-80% of time manually correlating findings instead of fixing them

### 1.3 Solution Overview
CLARA automatically:
1. **Ingests** multi-source vulnerability data (SAST, DAST, OSS)
2. **Deduplicates** identical findings across tools
3. **Clusters** vulnerabilities by attack surface (authentication, data access, etc.)
4. **Synthesizes** realistic attack chains spanning multiple vulnerability types
5. **Maps** findings to MITRE ATT&CK techniques and tactics
6. **Prioritizes** based on severity, exploitability, and business impact
7. **Visualizes** results through interactive dashboards

### 1.4 Target Users
- **Primary**: Security engineers and AppSec teams at tech companies
- **Secondary**: DevSecOps engineers, security consultants, penetration testers
- **Tertiary**: Engineering managers needing security risk visibility

### 1.5 Success Metrics
- **Time to Insight**: Reduce vulnerability triage time from hours to minutes
- **Accuracy**: 85%+ precision in attack chain identification
- **User Satisfaction**: 4.5/5 rating for "helps prioritize remediation"
- **Adoption**: Used in 3+ security assessment workflows within 6 months

---

## 2. User Stories & Use Cases

### 2.1 Core User Stories

**US-001: Multi-Source Analysis**  
**As a** security engineer  
**I want to** upload scan results from multiple tools simultaneously  
**So that** I can get a unified view without manual correlation  

**Acceptance Criteria:**
- System accepts JSON files from Bandit, ZAP, npm audit, OSV scanner
- Ingestion completes in <10 seconds for typical scan sizes (50-500 findings)
- Findings from different tools referencing same vulnerability are automatically deduplicated
- Upload interface provides drag-and-drop or file picker

---

**US-002: Attack Chain Visualization**  
**As a** AppSec engineer  
**I want to** see how vulnerabilities combine into attack paths  
**So that** I can understand realistic threat scenarios  

**Acceptance Criteria:**
- System generates 3-5 attack chains per analysis
- Each chain spans ≥2 attack surfaces (e.g., authentication + data access)
- Chains include step-by-step attacker narrative
- Business impact is specific to the analyzed application
- Severity scoring reflects actual risk, not just CVSS

---

**US-003: MITRE ATT&CK Mapping**  
**As a** security analyst  
**I want to** see which ATT&CK techniques are present in my codebase  
**So that** I can align remediation with threat intelligence frameworks  

**Acceptance Criteria:**
- Each attack chain maps to ≥1 MITRE ATT&CK technique
- Heatmap visualizes technique frequency across findings
- Technique IDs link to official MITRE documentation
- Tactics (Initial Access, Execution, etc.) are properly categorized

---

**US-004: Prioritized Remediation**  
**As a** engineering manager  
**I want to** see findings ranked by real-world risk  
**So that** I can allocate engineering resources effectively  

**Acceptance Criteria:**
- Chains sorted by fix_priority score (1-10)
- Priority considers: severity, exploitability, blast radius, confidence
- Top 3 chains highlighted as "Critical Path"
- Export function generates actionable remediation report

---

**US-005: Pre-Configured Target Templates**  
**As a** developer  
**I want to** quickly analyze common project types  
**So that** I don't have to manually configure scan tool combinations  

**Acceptance Criteria:**
- System includes templates for: Python/Django, Node.js/Express, Python libraries
- Templates pre-map to relevant scan tools (e.g., pygoat → Bandit + ZAP + OSV)
- Templates include context (stack, threat model, deployment environment)
- Custom upload mode available for unsupported project types

---

**US-006: Demo Mode for Evaluation**  
**As a** product evaluator  
**I want to** see CLARA's capabilities without running actual scans  
**So that** I can assess value before integrating into CI/CD  

**Acceptance Criteria:**
- Demo mode loads pre-cached results instantly (<2 seconds)
- Demo data represents realistic vulnerability scenarios
- All visualizations and features function identically to live mode
- Clear toggle between demo and live analysis

---

### 2.2 Use Case Scenarios

#### Scenario 1: Pre-Deployment Security Gate
**Actor:** DevOps engineer at SaaS company  
**Context:** CI/CD pipeline runs security scans before production deployment  
**Flow:**
1. Pipeline executes Bandit (SAST), ZAP (DAST), npm audit (OSS)
2. Scan JSON files automatically uploaded to CLARA API endpoint
3. CLARA analyzes and generates report
4. Pipeline gates deployment if ≥1 "critical" attack chain detected
5. Security team notified via Slack with CLARA dashboard link

#### Scenario 2: Quarterly Security Assessment
**Actor:** Security consultant performing client engagement  
**Context:** Need to deliver executive-level risk report  
**Flow:**
1. Consultant runs comprehensive scans on client application
2. Uploads all scan data to CLARA web interface
3. Reviews attack chains and validates findings
4. Exports CLARA report as PDF
5. Presents heatmap and attack chain visualizations to client executives

#### Scenario 3: Open Source Library Audit
**Actor:** Security researcher evaluating third-party library  
**Context:** Assessing library before adopting in enterprise project  
**Flow:**
1. Researcher selects "impacket" template (Python library)
2. CLARA loads SAST + OSS scan data
3. Discovers hardcoded credentials in example scripts
4. Identifies weak cryptography in protocol implementations
5. Maps findings to ATT&CK techniques relevant to network protocols
6. Researcher documents risks in adoption decision document

---

## 3. Functional Requirements

### 3.1 Data Ingestion (FR-001 to FR-010)

**FR-001: Multi-Format Input**  
System SHALL accept JSON files from the following security tools:
- Bandit (SAST for Python)
- OWASP ZAP (DAST)
- npm audit (OSS for Node.js)
- OSV scanner (OSS multi-language)

**FR-002: File Upload Interface**  
System SHALL provide web-based file upload supporting:
- Drag-and-drop file selection
- Multiple file simultaneous upload
- File categorization (SAST, DAST, OSS)
- Progress indication during upload

**FR-003: Target Templates**  
System SHALL include pre-configured templates for:
- pygoat (Python/Django web app)
- juice-shop (Node.js/Angular web app)
- impacket (Python library)

**FR-004: Custom Analysis Mode**  
System SHALL allow custom target analysis by:
- Uploading arbitrary scan files without template selection
- Auto-detecting scanner format from JSON structure
- Processing mixed-tool scan results

**FR-005: Data Validation**  
System SHALL validate uploaded files:
- Reject non-JSON files with clear error message
- Verify JSON structure matches expected scanner schema
- Handle malformed JSON gracefully without crashing
- Report missing required fields (e.g., severity, title)

**FR-006: Normalization**  
System SHALL normalize findings into unified schema:
- Map tool-specific severity values to standard scale (critical/high/medium/low/informational)
- Extract CWE/CVE identifiers
- Generate unique finding IDs
- Preserve source tool and target metadata

**FR-007: Deduplication**  
System SHALL deduplicate findings by:
- Content-based hashing (title + severity + location)
- Exact match removal across different tools
- Providing deduplication statistics in report

**FR-008: Throughput Requirements**  
System SHALL process:
- 500 findings in <15 seconds (ingestion + dedup)
- 100 findings in <5 seconds
- Maximum file size: 50MB per upload

**FR-009: Error Handling**  
System SHALL handle errors:
- Invalid file format → user-friendly error message
- Scan file missing data → proceed with partial analysis + warning
- API timeout → retry with exponential backoff (max 3 attempts)

**FR-010: Data Persistence**  
System SHALL:
- Maintain in-memory run state during active analysis
- Cache demo mode results to disk (golden files)
- NOT persist uploaded scan data after analysis completes

---

### 3.2 Analysis Pipeline (FR-020 to FR-040)

**FR-020: LangGraph State Machine**  
System SHALL execute analysis as LangGraph workflow with nodes:
1. ingest → 2. dedup → 3. cluster → 4. synthesize → 5. mitre_prioritize → 6. report

**FR-021: Attack Surface Clustering**  
System SHALL cluster findings into attack surfaces:
- authentication (weak auth, hardcoded creds, token issues)
- data_access (SQL injection, NoSQL injection)
- dependency_chain (OSS vulnerabilities, supply chain)
- network_transport (CORS, CSP, XSS, SSL/TLS issues)
- file_system (path traversal, file disclosure)
- session_management (CSRF, session fixation)
- admin_interface (debug mode, admin routes, error disclosure)

**FR-022: Clustering Rules**  
System SHALL apply clustering rules:
- Every finding MUST be assigned to exactly one surface
- SQL injection → data_access
- Hardcoded passwords → authentication
- npm CVEs → dependency_chain
- subprocess shell=True → dependency_chain (command injection context)

**FR-023: Attack Chain Synthesis**  
System SHALL synthesize attack chains with:
- 3-5 chains per analysis
- Each chain spans ≥2 attack surfaces
- Step-by-step attacker narrative (3-8 steps)
- Business impact specific to target application
- Finding references (IDs) supporting each chain

**FR-024: Chain Validation**  
System SHALL validate synthesized chains:
- All referenced finding IDs exist in input data
- Severity = highest severity among constituent findings
- Narrative contains ≥3 distinct steps
- Clusters_spanned ≥2

**FR-025: MITRE Mapping**  
System SHALL map findings to ATT&CK:
- SQL injection → T1190 (Exploit Public-Facing Application)
- Hardcoded credentials → T1552.001 (Credentials in Files)
- XSS → T1059.007 (JavaScript)
- CSRF → T1185 (Browser Session Hijacking)
- Supply chain CVE → T1195.002 (Compromise Software Supply Chain)

**FR-026: Priority Scoring**  
System SHALL calculate fix_priority (1-10 scale) based on:
- Severity weight: critical=10, high=7, medium=4, low=2
- Exploitability: presence of exploit code/PoC
- Blast radius: number of findings in chain
- Confidence: AI certainty in chain validity (0.0-1.0)

**FR-027: Progress Tracking**  
System SHALL emit progress events during analysis:
- step_start: when each pipeline node begins
- step_complete: when each node finishes (with result summary)
- chain_preview: when attack chain is synthesized
- complete: when full report is ready
- error: on any pipeline failure

**FR-028: Retry Logic**  
System SHALL retry failed LLM calls:
- Max 2 retry attempts per node
- Exponential backoff: 2s, 5s, 10s
- Validation feedback in retry prompt
- Terminal error after exhausting retries

**FR-029: Streaming Support**  
System SHALL support streaming analysis:
- Server-Sent Events (SSE) for real-time progress
- Chunked narrative text during synthesis
- Non-blocking execution for concurrent users

**FR-030: Demo Mode**  
System SHALL provide demo mode:
- Load pre-cached "golden" reports from disk
- Return results in <2 seconds
- Generate golden files on first successful run
- Identical visualization to live mode

**FR-040: LLM Provider Abstraction**  
System SHALL support multiple LLM backends:
- Google Gemini (cloud API via genai SDK)
- Google Vertex AI (GCP project-based)
- Ollama (local LLM)
- Groq (cloud API fallback)

---

### 3.3 Reporting & Visualization (FR-050 to FR-070)

**FR-050: Report Schema**  
System SHALL generate JSON report containing:
- Executive summary (2-3 sentence overview)
- Statistics: total findings, duplicates removed, findings by severity/tool
- Attack chains (sorted by priority)
- Raw findings list (optional, for drill-down)
- MITRE technique coverage

**FR-051: Attack Chain Card**  
System SHALL display each chain with:
- Name (e.g., "SQL Injection to Data Exfiltration")
- Severity badge with color coding
- Fix priority score (1-10)
- Confidence score (0.0-1.0)
- Numbered narrative steps
- Business impact statement
- Affected locations (files/packages)
- MITRE technique tags
- Expandable raw findings detail

**FR-052: MITRE Heatmap**  
System SHALL visualize ATT&CK coverage:
- Grid layout with tactics as columns
- Technique cells color-coded by frequency
- Hover tooltips with technique details
- Click to filter chains by technique

**FR-053: Severity Distribution Chart**  
System SHALL display severity breakdown:
- Pie chart or bar chart
- Color coding: critical=red, high=orange, medium=yellow, low=blue
- Counts and percentages
- Interactive legend filtering

**FR-054: Pipeline Progress Indicator**  
System SHALL show analysis progress:
- Step-by-step visualization (ingest → dedup → cluster → synthesize → mitre → report)
- Current step highlighted
- Completion percentage
- Step-specific result summaries (e.g., "42 unique findings")

**FR-055: Stats Panel**  
System SHALL display aggregate statistics:
- Total findings scanned
- Duplicates removed count
- Unique findings count
- Findings by tool (Bandit, ZAP, npm, OSV)
- Total attack chains synthesized

**FR-056: Kill Chain Flow Diagram**  
System SHALL visualize attack progression:
- Flow chart showing initial access → execution → persistence → exfiltration
- Nodes representing attack stages
- Edges connecting related vulnerabilities
- Color-coded by severity

**FR-057: Export Functionality**  
System SHALL support export:
- JSON report download
- Filename format: `clara-report-{target}-{timestamp}.json`
- Full data preservation for external tooling integration

**FR-058: Responsive Design**  
System SHALL render on:
- Desktop browsers (1920x1080, 1366x768)
- Tablet devices (768px width minimum)
- Support Chrome, Firefox, Safari, Edge (latest 2 versions)

**FR-060: Accessibility**  
System SHALL meet basic accessibility:
- Keyboard navigation for all interactive elements
- Screen reader-compatible semantic HTML
- WCAG 2.1 AA contrast ratios
- Focus indicators on all buttons/links

**FR-070: AI Fix Suggestions**  
System SHALL provide remediation guidance:
- "Suggest Fix" button on each attack chain
- LLM-generated remediation steps (3-5 bullet points)
- Specific code examples when applicable
- Clear, developer-friendly language

---

### 3.4 API Specifications (FR-080 to FR-095)

**FR-080: RESTful API Design**  
System SHALL expose HTTP JSON API with endpoints:
- `GET /targets` — List available target templates
- `POST /analyze` — Start new analysis
- `GET /analyze/{run_id}/stream` — SSE progress stream
- `GET /analyze/{run_id}/result` — Retrieve completed report
- `POST /suggest-fix` — Generate remediation advice

**FR-081: CORS Configuration**  
System SHALL allow cross-origin requests:
- `Access-Control-Allow-Origin: *` (hackathon deployment)
- Production deployment SHOULD restrict to specific domains

**FR-082: Rate Limiting**  
System SHOULD implement rate limiting:
- 10 requests/minute per IP address
- Prevent LLM API quota exhaustion
- Return HTTP 429 when exceeded

**FR-083: Request Validation**  
System SHALL validate API requests:
- Require `target` field in POST /analyze
- Reject unknown target names with HTTP 400
- Validate uploaded_files schema if present

**FR-084: Error Responses**  
System SHALL return structured errors:
```json
{
  "detail": "Unknown target 'invalid-name'",
  "status_code": 400
}
```

**FR-085: SSE Protocol**  
System SHALL stream events via SSE:
- Event format: `data: {JSON}\n\n`
- Event types: step_start, step_complete, chain_preview, complete, error
- Connection timeout: 5 minutes
- Auto-reconnect on client disconnect

**FR-090: Health Check**  
System SHOULD expose health endpoint:
- `GET /health` → `{"status": "ok", "llm_provider": "gemini"}`

**FR-095: API Versioning**  
Future versions SHOULD use URL versioning:
- `/v1/analyze`, `/v2/analyze`, etc.

---

## 4. Non-Functional Requirements

### 4.1 Performance
- **NFR-001**: Analysis completes in <30 seconds for 100 findings (Gemini)
- **NFR-002**: Analysis completes in <90 seconds for 100 findings (Ollama CPU)
- **NFR-003**: Frontend initial load <2 seconds on 10 Mbps connection
- **NFR-004**: API response time <200ms (non-LLM endpoints)
- **NFR-005**: Support ≥5 concurrent analyses (in-memory state isolation)

### 4.2 Scalability
- **NFR-010**: Handle up to 1000 findings per analysis
- **NFR-011**: Support 50 concurrent SSE connections
- **NFR-012**: Stateless backend design (horizontal scaling ready)

### 4.3 Reliability
- **NFR-020**: 99% uptime during hackathon demo period
- **NFR-021**: Graceful degradation on LLM API failure (retry + fallback to Groq)
- **NFR-022**: No data loss during analysis (in-memory state preserved until completion)

### 4.4 Security
- **NFR-030**: No persistent storage of uploaded scan data (privacy by design)
- **NFR-031**: API keys stored in environment variables, never committed to git
- **NFR-032**: Input validation on all user-provided data
- **NFR-033**: HTTPS required for production deployment

### 4.5 Usability
- **NFR-040**: Zero-configuration demo mode (no API key required)
- **NFR-041**: Onboarding tutorial <5 minutes to first analysis
- **NFR-042**: Error messages provide clear remediation steps
- **NFR-043**: Visual feedback on all async operations (loading states)

### 4.6 Maintainability
- **NFR-050**: 80% code coverage on backend pipeline nodes
- **NFR-051**: Type hints on all Python functions
- **NFR-052**: ESLint + Prettier for frontend code consistency
- **NFR-053**: Comprehensive README with setup instructions

### 4.7 Compatibility
- **NFR-060**: Python 3.10+ (backend)
- **NFR-061**: Node.js 18+ (frontend build)
- **NFR-062**: Modern browser support (no IE11)

---

## 5. Out of Scope (v1.0)

The following features are explicitly NOT included in current version:

1. **User Authentication**: No login system, no multi-user support
2. **Persistent Database**: No PostgreSQL/MongoDB, only in-memory state
3. **CI/CD Integration Plugins**: No GitHub Actions, GitLab CI, Jenkins plugins
4. **Slack/Email Notifications**: No external integrations
5. **Custom Scan Tool Plugins**: Only supports Bandit, ZAP, npm audit, OSV scanner
6. **Report Templates**: Only JSON export, no PDF/HTML generation
7. **Historical Trend Analysis**: No time-series tracking of vulnerabilities
8. **Multi-Project Management**: Single analysis at a time per user
9. **Role-Based Access Control**: No admin/viewer roles
10. **Compliance Reporting**: No PCI-DSS, SOC2, HIPAA mapping

---

## 6. Future Roadmap (Post-v1.0)

### Phase 2: Enterprise Features (Q3 2026)
- PostgreSQL persistence layer
- User authentication (OAuth2, SAML)
- Multi-tenant workspace support
- Historical analysis dashboard
- Trend analytics and metrics

### Phase 3: Integration Ecosystem (Q4 2026)
- GitHub Actions integration
- GitLab CI plugin
- Jira ticket auto-creation
- Slack/Teams notifications
- Webhook support for custom workflows

### Phase 4: Advanced Analysis (Q1 2027)
- Custom scan tool adapters (Checkmarx, Snyk, Fortify)
- AI-powered false positive detection
- Automated patch suggestion
- Threat model generation
- Compliance framework mapping (PCI-DSS, NIST)

---

## 7. Dependencies & Constraints

### 7.1 External Dependencies
- **LLM APIs**: Google Gemini API (primary), Groq API (fallback)
- **Python Libraries**: FastAPI, LangGraph, Pydantic, python-dotenv
- **Frontend Libraries**: React 18, Vite 6, Tailwind CSS 3
- **Security Tools**: Bandit, ZAP, npm audit, OSV scanner (for generating input data)

### 7.2 Constraints
- **Budget**: $50 Gemini API budget for hackathon
- **Timeline**: 48-hour development sprint (Hook'em Hacks 2026)
- **Team Size**: 1-4 developers
- **Demo Environment**: Local deployment (no cloud hosting requirement)

### 7.3 Assumptions
- Users have basic security knowledge (understand CVE, CVSS, MITRE ATT&CK)
- Scan data is pre-generated (CLARA does not run scanners)
- Demo targets use publicly available vulnerable applications

---

## 8. Acceptance Criteria (Definition of Done)

A feature is considered DONE when:

1. ✅ Code implemented and merged to main branch
2. ✅ Unit tests pass (if applicable)
3. ✅ Manual testing completed on demo targets (pygoat, juice-shop, impacket)
4. ✅ Documentation updated (README, API docs, inline comments)
5. ✅ Peer review completed (if team size >1)
6. ✅ Demo mode functional (for evaluators without API keys)
7. ✅ No critical bugs blocking hackathon presentation
8. ✅ User-facing error messages are clear and actionable

---

## 9. Glossary

- **SAST**: Static Application Security Testing (code analysis)
- **DAST**: Dynamic Application Security Testing (runtime testing)
- **OSS**: Open Source Software vulnerability scanning
- **MITRE ATT&CK**: Framework for categorizing adversary tactics and techniques
- **CWE**: Common Weakness Enumeration (vulnerability types)
- **CVE**: Common Vulnerabilities and Exposures (specific vulnerability instances)
- **CVSS**: Common Vulnerability Scoring System (severity metric)
- **SSE**: Server-Sent Events (HTTP streaming protocol)
- **LangGraph**: Framework for building stateful, multi-step LLM applications
- **Attack Surface**: Category of vulnerabilities by system component
- **Attack Chain**: Sequence of exploits spanning multiple vulnerabilities
- **Blast Radius**: Scope of damage an attack could cause
- **Golden File**: Pre-cached analysis result for demo mode

---

**Document End**
