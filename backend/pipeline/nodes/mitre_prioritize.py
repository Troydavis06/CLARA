"""MITRE ATT&CK mapping + chain prioritization — Gemini call 3."""

import json

from ..gemini_utils import generate_with_backoff, get_client, default_model

_SYSTEM = """You are CLARA, a security analysis engine. Respond with valid JSON only.
RULES:
- ONLY use MITRE ATT&CK Enterprise technique IDs that exist in the published matrix (T1xxx or T1xxx.xxx format).
- When uncertain, use the parent technique rather than inventing a sub-technique.
- Never invent technique names or tactic names.
- fix_priority must be unique integers 1..N where N = number of chains, 1 = most urgent.
- confidence must be a float between 0.0 and 1.0.
"""

_MITRE_CONTEXT = """
Available MITRE ATT&CK techniques (use only from this list):
- T1190: Exploit Public-Facing Application (initial-access)
- T1059: Command and Scripting Interpreter (execution)
- T1059.006: Python (execution)
- T1552: Unsecured Credentials (credential-access)
- T1552.001: Credentials In Files (credential-access)
- T1110: Brute Force (credential-access)
- T1078: Valid Accounts (defense-evasion, persistence, privilege-escalation, initial-access)
- T1071: Application Layer Protocol (command-and-control)
- T1566: Phishing (initial-access)
- T1499: Endpoint Denial of Service (impact)
- T1203: Exploitation for Client Execution (execution)
- T1055: Process Injection (privilege-escalation)
- T1574: Hijack Execution Flow (persistence, privilege-escalation, defense-evasion)
- T1083: File and Directory Discovery (discovery)
- T1041: Exfiltration Over C2 Channel (exfiltration)
- T1005: Data from Local System (collection)
- T1134: Access Token Manipulation (privilege-escalation, defense-evasion)
- T1539: Steal Web Session Cookie (credential-access)
"""

_PROMPT = """## Task: MITRE MAP + PRIORITIZE

{mitre_context}

Confidence scoring rubric:
- 0.9-1.0: Multiple SAST + DAST findings confirm same vulnerability at same location
- 0.7-0.89: Single high-confidence finding OR CVSS >= 8.0
- 0.5-0.69: Medium-confidence finding OR CVSS 4.0-7.9
- 0.3-0.49: Low-confidence or informational-only evidence
- <0.3: Theoretical based on code pattern only

For each attack chain below:
1. Assign 1-3 MITRE ATT&CK techniques (max 3 per chain)
2. Assign fix_priority (1 = most urgent, must be unique across all chains)
3. Assign confidence score (0.0-1.0, two decimal places)
4. Compute exploitability_score (sum: auth_required 0-2 + network_exposure 0-2 + complexity 0-2; lower = more exploitable)
5. Write blast_radius_notes (1-2 sentences on scope of damage)

Return ONLY this JSON schema:
{{
  "scored_chains": [
    {{
      "chain_id": "CHAIN-01",
      "mitre_techniques": [
        {{"id": "T1190", "name": "Exploit Public-Facing Application", "tactic": "initial-access"}}
      ],
      "fix_priority": 1,
      "confidence": 0.85,
      "exploitability_score": 1,
      "blast_radius_notes": "string"
    }}
  ],
  "scoring_summary": "string",
  "warnings": []
}}

CHAINS TO SCORE:
{chains_json}

FINDING SEVERITIES (for confidence calculation):
{finding_severities_json}
"""


def _validate(scored: list[dict], chain_ids: list[str]) -> str | None:
    if len(scored) != len(chain_ids):
        return f"Expected {len(chain_ids)} scored chains, got {len(scored)}"
    priorities = [s.get("fix_priority") for s in scored]
    if sorted(priorities) != list(range(1, len(chain_ids) + 1)):
        return f"fix_priority values must be unique 1..{len(chain_ids)}, got {sorted(priorities)}"
    for s in scored:
        conf = s.get("confidence", -1)
        if not (0.0 <= conf <= 1.0):
            return f"confidence {conf} out of range for chain {s.get('chain_id')}"
        techs = s.get("mitre_techniques", [])
        if not techs:
            return f"No MITRE techniques for chain {s.get('chain_id')}"
        if len(techs) > 3:
            return f"More than 3 MITRE techniques for chain {s.get('chain_id')}"
    return None


def run(state: dict) -> dict:
    chains: list[dict] = state.get("chains", [])
    findings: list[dict] = state.get("deduped_findings", [])

    if not chains:
        return {**state, "scored_chains": [], "current_step": "mitre_prioritize"}

    client = get_client()
    model = default_model()

    sev_lookup = {f["id"]: f["severity"] for f in findings}
    finding_severities = {
        c["id"]: {fid: sev_lookup.get(fid, "unknown") for fid in c.get("finding_ids", [])}
        for c in chains
    }

    prompt = _PROMPT.format(
        mitre_context=_MITRE_CONTEXT,
        chains_json=json.dumps(chains, indent=2),
        finding_severities_json=json.dumps(finding_severities, indent=2),
    )

    chain_ids = [c["id"] for c in chains]

    for attempt in range(2):
        text = generate_with_backoff(client, model, prompt, _SYSTEM)
        try:
            result = json.loads(text)
        except json.JSONDecodeError as e:
            if attempt == 0:
                prompt += f"\n\nVALIDATION ERROR: Not valid JSON ({e}). Try again."
                continue
            return {**state, "error": "mitre_prioritize: invalid JSON", "current_step": "mitre_prioritize"}

        scored = result.get("scored_chains", [])
        error = _validate(scored, chain_ids)
        if error:
            if attempt == 0:
                prompt += f"\n\nVALIDATION ERROR: {error}. Correct it and respond again."
                continue
            return {**state, "error": f"mitre_prioritize: {error}", "current_step": "mitre_prioritize"}

        return {**state, "scored_chains": scored, "error": None, "current_step": "mitre_prioritize"}

    return {**state, "error": "mitre_prioritize: validation failed after retry", "current_step": "mitre_prioritize"}
