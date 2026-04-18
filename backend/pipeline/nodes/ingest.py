"""Ingest raw scan JSON for a target → list[Finding] (pure Python, no AI)."""

import hashlib
import json
import re
from pathlib import Path

from ..config import Finding, TARGETS


_BANDIT_SEV = {"HIGH": "high", "MEDIUM": "medium", "LOW": "low"}
_ZAP_SEV = {"3": "high", "2": "medium", "1": "low", "0": "informational"}
_OSS_SEV = {
    "critical": "critical",
    "high": "high",
    "moderate": "medium",
    "medium": "medium",
    "low": "low",
}


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text).strip()


def _make_id(parts: list[str]) -> str:
    raw = ":".join(str(p) for p in parts)
    return hashlib.sha1(raw.encode()).hexdigest()[:12]


def ingest_bandit(results: list[dict], source_target: str, id_prefix: str) -> list[Finding]:
    findings = []
    for i, r in enumerate(results):
        filename = r.get("filename", "")
        # Shorten absolute path to relative from targets/
        if "targets" in filename:
            filename = "targets/" + filename.split("targets")[-1].lstrip("/\\").replace("\\", "/")
        line = r.get("line_number", 0)
        location = f"{filename}:{line}"
        sev = _BANDIT_SEV.get(r.get("issue_severity", "").upper(), "low")
        cwe_raw = r.get("issue_cwe", {})
        cwe = [f"CWE-{cwe_raw['id']}"] if isinstance(cwe_raw, dict) and "id" in cwe_raw else []
        # Truncate code snippet to 3 lines
        code_lines = r.get("code", "").strip().splitlines()[:3]
        code_snippet = " | ".join(l.strip() for l in code_lines if l.strip())
        desc = r.get("issue_text", "")
        if code_snippet:
            desc = f"{desc} [{code_snippet}]"
        findings.append(Finding(
            id=f"{id_prefix}-{r.get('test_id', 'B000')}-{i:03d}",
            source_tool="bandit",
            source_target=source_target,
            title=r.get("test_name", "unknown").replace("_", " ").title(),
            description=desc,
            severity=sev,
            location=location,
            cwe=cwe,
            cve=None,
        ))
    return findings


def ingest_zap(alerts: list[dict], source_target: str, id_prefix: str) -> list[Finding]:
    findings = []
    for i, a in enumerate(alerts):
        riskcode = str(a.get("riskcode", "0"))
        sev = _ZAP_SEV.get(riskcode, "informational")
        cweid = a.get("cweid", "")
        cwe = [f"CWE-{cweid}"] if cweid and cweid != "0" else []
        solution = _strip_html(a.get("solution", ""))
        findings.append(Finding(
            id=f"{id_prefix}-ZAP-{i:03d}",
            source_tool="zap",
            source_target=source_target,
            title=a.get("name", "Unknown Alert"),
            description=solution[:300] if solution else a.get("riskdesc", ""),
            severity=sev,
            location=f"{source_target}:{a.get('name', 'unknown')}",
            cwe=cwe,
            cve=None,
        ))
    return findings


def ingest_oss(vulns: list[dict], source_target: str) -> list[Finding]:
    findings = []
    tool_abbrev = {"npm-audit": "NPM", "osv-scanner": "OSV"}
    counters: dict[str, int] = {}
    for v in vulns:
        if v.get("_source") != source_target:
            continue
        tool = v.get("_tool", "osv-scanner")
        abbrev = tool_abbrev.get(tool, "OSV")
        idx = counters.get(abbrev, 0)
        counters[abbrev] = idx + 1
        sev = _OSS_SEV.get(v.get("severity", "").lower(), "medium")
        pkg = v.get("package", "unknown")
        cve_raw = v.get("cve", "") or ""
        cve = cve_raw if cve_raw.startswith(("CVE-", "GHSA-", "PYSEC-")) else None
        cwe_list = v.get("cwe", []) or []
        findings.append(Finding(
            id=f"{source_target}-{abbrev}-{idx:03d}",
            source_tool=tool,
            source_target=source_target,
            title=v.get("title", pkg),
            description=f"{pkg}: {v.get('title', '')} (CVSS: {v.get('cvss') or 'N/A'})",
            severity=sev,
            location=f"{pkg}@latest",
            cwe=cwe_list,
            cve=cve,
        ))
    return findings


def run(state: dict) -> dict:
    target = state["target"]
    cfg = state["target_config"]
    findings: list[Finding] = []

    # SAST (Bandit)
    if cfg.get("sast") and cfg.get("sast_source"):
        data = json.loads(Path(cfg["sast"]).read_text(encoding="utf-8"))
        results = [r for r in data.get("results", []) if r.get("_source") == cfg["sast_source"]]
        findings.extend(ingest_bandit(results, cfg["sast_source"], cfg["sast_source"]))

    # DAST (ZAP)
    if cfg.get("dast") and cfg.get("dast_source"):
        data = json.loads(Path(cfg["dast"]).read_text(encoding="utf-8"))
        findings.extend(ingest_zap(data.get("alerts", []), cfg["dast_source"], cfg["dast_source"]))

    # OSS (npm-audit / osv-scanner)
    if cfg.get("oss") and cfg.get("oss_source"):
        data = json.loads(Path(cfg["oss"]).read_text(encoding="utf-8"))
        findings.extend(ingest_oss(data.get("vulnerabilities", []), cfg["oss_source"]))

    normalized = [f.to_dict() for f in findings]
    return {**state, "normalized_findings": normalized, "current_step": "ingest"}
