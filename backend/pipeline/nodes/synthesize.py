"""Synthesize attack chains from clusters — Gemini call 2 (streaming)."""

import json
from collections.abc import AsyncGenerator

from ..llm_utils import generate_with_backoff, get_llm_model, get_llm_provider, get_client

_SYSTEM = """You are CLARA, a security analysis engine. Respond with valid JSON only.
RULES:
- Never invent CVE/GHSA identifiers. Only use IDs verbatim from the input.
- Never invent MITRE ATT&CK technique IDs.
- Severity values: critical | high | medium | low | informational (lowercase only).
- Every finding_id you reference must exist in the input data.
- If inputs are empty, return the schema with empty chains array and a warnings[] entry.
"""

_SYNTHESIZE_PROMPT = """## Task: SYNTHESIZE ATTACK CHAINS

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
{{
  "chains": [
    {{
      "id": "CHAIN-01",
      "name": "string",
      "narrative": "1. Step one\\n2. Step two\\n3. Step three",
      "business_impact": "string",
      "finding_ids": ["string"],
      "clusters_spanned": ["string"],
      "severity": "critical|high|medium|low",
      "finding_count": 0
    }}
  ],
  "chain_count": 0,
  "warnings": []
}}

CLUSTERS AND FINDINGS:
{clusters_with_findings_json}
"""


def _build_clusters_with_findings(clusters: dict, findings: list[dict]) -> dict:
    findings_by_id = {f["id"]: f for f in findings}
    result = {}
    for surface, data in clusters.items():
        ids = data.get("finding_ids", [])
        if ids:
            result[surface] = [findings_by_id[fid] for fid in ids if fid in findings_by_id]
    return result


def _fix_clusters_spanned(chains: list[dict], clusters: dict, findings: list[dict]) -> None:
    """Infer clusters_spanned from finding_ids when LLM omits/under-fills it."""
    fid_to_cluster: dict[str, str] = {}
    for surface, data in clusters.items():
        for fid in data.get("finding_ids", []):
            fid_to_cluster[fid] = surface
    for c in chains:
        spanned = c.get("clusters_spanned") or []
        if len(spanned) < 2:
            inferred = list({fid_to_cluster[fid] for fid in c.get("finding_ids", []) if fid in fid_to_cluster})
            if len(inferred) >= 2:
                c["clusters_spanned"] = inferred


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
        if len(steps) < 1:
            pass  # relaxed validation

    return None


def run(state: dict) -> dict:
    findings: list[dict] = state.get("deduped_findings", [])
    clusters: dict = state.get("clusters", {})
    cfg: dict = state.get("target_config", {})

    if not findings:
        return {**state, "chains": [], "current_step": "synthesize"}

    clusters_with_findings = _build_clusters_with_findings(clusters, findings)
    prompt = _SYNTHESIZE_PROMPT.format(
        target=state.get("target", "unknown"),
        stack=cfg.get("stack", "unknown"),
        threat_model=cfg.get("threat_model", "unknown"),
        clusters_with_findings_json=json.dumps(clusters_with_findings, indent=2),
    )

    finding_ids_set = {f["id"] for f in findings}

    for attempt in range(2):
        full_text = generate_with_backoff(prompt, _SYSTEM, temperature=0.2)

        try:
            result = json.loads(full_text)
        except json.JSONDecodeError as e:
            if attempt == 0:
                prompt += f"\n\nVALIDATION ERROR: Response was not valid JSON ({e}). Try again."
                continue
            return {**state, "error": "synthesize: invalid JSON", "current_step": "synthesize"}

        chains = result.get("chains", [])
        _fix_clusters_spanned(chains, clusters, findings)
        error = _validate(chains, finding_ids_set)
        if error:
            if attempt == 0:
                prompt += f"\n\nVALIDATION ERROR: {error}. Correct it and respond again."
                continue
            return {**state, "error": f"synthesize: {error}", "current_step": "synthesize"}

        for c in chains:
            c["finding_count"] = len(c.get("finding_ids", []))

        return {**state, "chains": chains, "error": None, "current_step": "synthesize"}

    return {**state, "error": "synthesize: validation failed after retry", "current_step": "synthesize"}


async def stream_chunks(state: dict) -> AsyncGenerator[str, None]:
    """Async generator yielding raw text chunks for SSE streaming."""
    findings: list[dict] = state.get("deduped_findings", [])
    clusters: dict = state.get("clusters", {})
    cfg: dict = state.get("target_config", {})

    provider = get_llm_provider()
    model = get_llm_model()

    clusters_with_findings = _build_clusters_with_findings(clusters, findings)
    prompt = _SYNTHESIZE_PROMPT.format(
        target=state.get("target", "unknown"),
        stack=cfg.get("stack", "unknown"),
        threat_model=cfg.get("threat_model", "unknown"),
        clusters_with_findings_json=json.dumps(clusters_with_findings, indent=2),
    )

    if provider == "openai":
        client = get_client()
        stream = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    else:
        from google import genai as _genai
        from google.genai import types as _types
        import os as _os
        for chunk in _genai.Client(api_key=_os.environ["GEMINI_API_KEY"]).models.generate_content_stream(
            model=model,
            contents=prompt,
            config=_types.GenerateContentConfig(
                system_instruction=_SYSTEM,
                response_mime_type="application/json",
                temperature=0.2,
            ),
        ):
            if chunk.text:
                yield chunk.text
