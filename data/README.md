# CLARA Hackathon Scan Data

Real vulnerability scan outputs collected from three open-source software targets. Used as input to the CLARA triage agent (LangGraph pipeline) for SAST + DAST + OSS prioritization with MITRE ATT&CK enrichment.

---

## Targets

### 1. OWASP Juice Shop (`juice-shop/`)
- **Type:** Web application (Node.js / Angular)
- **Repo:** https://github.com/juice-shop/juice-shop
- **Why:** OWASP's canonical intentionally-vulnerable web app. Industry-standard for security training and DAST demonstrations.
- **Scans:**
  - `npm_audit.json` — OSS dependency scan via `npm audit --json`
  - `zap_report.json` — DAST full scan via OWASP ZAP (`zap-full-scan.py`), 14 alerts

### 2. OWASP pygoat (`pygoat/`)
- **Type:** Web application (Python / Django)
- **Repo:** https://github.com/adeyosemanputra/pygoat
- **Why:** OWASP's Python/Django vulnerable app covering OWASP Top 10 A01–A10. Designed to produce real Bandit and DAST findings.
- **Scans:**
  - `bandit_report.json` — SAST scan via `python -m bandit -r . -f json -ll`
  - `zap_report.json` — DAST baseline scan via OWASP ZAP (`zap-baseline.py`), 17 alerts
  - `osv_scan.json` — OSS scan via `osv-scanner scan source`, 220 CVEs across 13 packages

### 3. Impacket (`impacket/`)
- **Type:** Security library (Python — SMB, Kerberos, NTLM protocols)
- **Repo:** https://github.com/fortra/impacket
- **Why:** Core library behind many real-world ATT&CK techniques (T1550, T1558, T1021.002). SAST findings in Impacket map almost directly to ATT&CK TTPs — ideal for the triage agent's MITRE enrichment layer. Not a web app, so no DAST scan.
- **Scans:**
  - `bandit_report.json` — SAST scan via `python -m bandit -r . -f json -ll`
  - `osv_scan.json` — OSS scan via `osv-scanner scan source`, 10 CVEs across 3 packages

---

## Tool Versions & Commands

| Tool | Version | Command |
|------|---------|---------|
| Bandit (SAST) | latest pip | `python -m bandit -r <target> -f json -o report.json -ll --exit-zero` |
| OWASP ZAP (DAST) | ghcr.io/zaproxy/zaproxy:stable | `zap-full-scan.py` / `zap-baseline.py -t http://host -J report.json -I` |
| npm audit (OSS) | bundled with Node.js | `npm audit --json > report.json` |
| osv-scanner (OSS) | ghcr.io/google/osv-scanner | `docker run --rm -v <target>:/src:ro ghcr.io/google/osv-scanner scan source /src --format json` |

---

## Finding Counts

| Target | Tool | Count | Key Severities |
|--------|------|-------|----------------|
| Juice Shop | npm audit | 55 total | 7 critical, 31 high, 11 moderate |
| Juice Shop | ZAP DAST (full scan) | 14 alerts | CORS, CSP, backup file disclosure, 403 bypass |
| pygoat | Bandit SAST | 21 results | SQL injection, subprocess, weak crypto |
| pygoat | ZAP DAST (baseline) | 17 alerts | CSRF missing, CSP, Python source disclosure |
| pygoat | osv-scanner | 220 CVEs, 13 packages | Django, Werkzeug, PyYAML, cryptography, urllib3 |
| Impacket | Bandit SAST | 142 results | Subprocess, weak crypto, hardcoded values |
| Impacket | osv-scanner | 10 CVEs, 3 packages | pygments, pycryptodomex, setuptools |

---

## MITRE ATT&CK Mapping Reference

| Finding Type | Source | ATT&CK Code |
|---|---|---|
| SQL Injection | Bandit / ZAP | T1190 – Exploit Public-Facing Application |
| Hardcoded credentials | Bandit | T1552.001 – Credentials in Files |
| Command injection / subprocess | Bandit | T1059.004 – Unix Shell |
| Weak crypto (MD5/RC4/DES) | Bandit | T1600 – Weaken Encryption |
| XSS (reflected/stored) | ZAP | T1059.007 – JavaScript |
| Missing CSRF protection | ZAP | T1185 – Browser Session Hijacking |
| Path traversal | ZAP | T1083 – File and Directory Discovery |
| Supply chain CVE | npm audit | T1195.002 – Compromise Software Supply Chain |
| Prototype pollution | npm audit | T1059.007 – JavaScript |
| SMB/Kerberos protocol abuse | Bandit (Impacket) | T1558 – Steal or Forge Kerberos Tickets |
| Authentication bypass | ZAP | T1078 – Valid Accounts |

---

## Data Collection Date

April 17, 2026
