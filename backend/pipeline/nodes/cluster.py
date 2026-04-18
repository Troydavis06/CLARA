"""Cluster findings by attack surface — Gemini call 1."""

import json

from ..config import VALID_SURFACES
from ..llm_utils import generate_with_backoff, get_llm_model

_SYSTEM = """You are CLARA, a security analysis engine. Respond with valid JSON only.
RULES:
- Never invent CVE/GHSA identifiers.
- Never invent MITRE ATT&CK technique IDs.
- Severity values: critical | high | medium | low | informational (lowercase only).
- If inputs are empty, return the schema with empty arrays and a warnings[] entry.
"""

_CLUSTER_PROMPT = """## Task: CLUSTER

Assign every finding below to exactly one attack surface category.

Valid surfaces (use ONLY these keys):
  authentication, data_access, dependency_chain, network_transport,
  file_system, session_management, admin_interface

Assignment rules:
- SQL injection → data_access
- Hardcoded passwords/secrets → authentication
- Weak crypto used for auth tokens/passwords → authentication
- Weak crypto as a library CVE → dependency_chain
- npm/OSS/pip CVEs → dependency_chain
- ZAP session/cookie findings → session_management
- ZAP CORS/CSP/header findings → network_transport
- File disclosure, path traversal → file_system
- Flask/Django debug mode, admin routes → admin_interface
- CSRF → session_management
- XSS → network_transport

Return ONLY this JSON schema:
{{
  "clusters": {{
    "authentication":     {{"finding_ids": [], "count": 0}},
    "data_access":        {{"finding_ids": [], "count": 0}},
    "dependency_chain":   {{"finding_ids": [], "count": 0}},
    "network_transport":  {{"finding_ids": [], "count": 0}},
    "file_system":        {{"finding_ids": [], "count": 0}},
    "session_management": {{"finding_ids": [], "count": 0}},
    "admin_interface":    {{"finding_ids": [], "count": 0}}
  }},
  "total_assigned": 0,
  "warnings": []
}}

FINDINGS TO CLUSTER:
{findings_json}
"""


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


def run(state: dict) -> dict:
    findings: list[dict] = state.get("deduped_findings", [])
    if not findings:
        return {**state, "clusters": {s: {"finding_ids": [], "count": 0} for s in VALID_SURFACES},
                "current_step": "cluster"}

    slim = [{"id": f["id"], "title": f["title"], "severity": f["severity"],
             "cwe": f["cwe"], "source_tool": f["source_tool"]} for f in findings]

    prompt = _CLUSTER_PROMPT.format(findings_json=json.dumps(slim, indent=2))

    for attempt in range(2):
        text = generate_with_backoff(prompt, _SYSTEM)
        try:
            result = json.loads(text)
        except (json.JSONDecodeError, Exception) as e:
            if attempt == 0:
                prompt += f"\n\nVALIDATION ERROR: Response was not valid JSON ({e}). Try again."
                continue
            return {**state, "error": "cluster: invalid JSON after retry", "current_step": "cluster"}

        error = _validate(result, len(findings))
        if error:
            if attempt == 0:
                prompt += f"\n\nVALIDATION ERROR: {error}. Correct it and respond again."
                continue
            return {**state, "error": f"cluster: {error}", "current_step": "cluster"}

        for surface in VALID_SURFACES:
            if surface in result["clusters"]:
                result["clusters"][surface]["count"] = len(result["clusters"][surface]["finding_ids"])
            else:
                result["clusters"][surface] = {"finding_ids": [], "count": 0}

        return {**state, "clusters": result["clusters"], "error": None, "current_step": "cluster"}

    return {**state, "error": "cluster: validation failed after retry", "current_step": "cluster"}
