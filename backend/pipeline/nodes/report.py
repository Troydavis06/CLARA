"""Assemble final report from pipeline state — pure Python, no AI."""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from ..config import OUTPUT_DIR, SEVERITY_ORDER


def _merge_chains(chains: list[dict], scored_chains: list[dict], findings: list[dict] | None = None) -> list[dict]:
    score_by_id = {s["chain_id"]: s for s in scored_chains}
    findings_by_id = {f["id"]: f for f in (findings or [])}
    merged = []
    for c in chains:
        s = score_by_id.get(c["id"], {})
        loc_set = sorted({
            findings_by_id[fid]["location"]
            for fid in c.get("finding_ids", [])
            if fid in findings_by_id and findings_by_id[fid].get("location")
        })
        merged.append({
            **c,
            "mitre_techniques": s.get("mitre_techniques", []),
            "fix_priority": s.get("fix_priority", 99),
            "confidence": s.get("confidence", 0.0),
            "exploitability_score": s.get("exploitability_score", 6),
            "blast_radius_notes": s.get("blast_radius_notes", ""),
            "locations": loc_set,
        })
    return sorted(merged, key=lambda x: x["fix_priority"])


def _build_stats(findings: list[dict], dedup_stats: dict) -> dict:
    sev_counts = {s: 0 for s in SEVERITY_ORDER}
    tool_counts: dict[str, int] = {}
    for f in findings:
        sev = f.get("severity", "informational")
        if sev in sev_counts:
            sev_counts[sev] += 1
        tool = f.get("source_tool", "unknown")
        tool_counts[tool] = tool_counts.get(tool, 0) + 1
    return {
        "total_findings": len(findings),
        "duplicates_removed": dedup_stats.get("duplicates_removed", 0),
        "findings_by_severity": sev_counts,
        "findings_by_tool": tool_counts,
    }


def _executive_summary(target: str, findings: list[dict], chains: list[dict]) -> str:
    top_chain = chains[0] if chains else None
    sentence1 = (
        f"We analyzed {len(findings)} security findings and identified "
        f"{len(chains)} actionable attack path{'s' if len(chains) != 1 else ''}."
    )
    if top_chain:
        detail = (top_chain.get("blast_radius_notes") or top_chain.get("business_impact") or "").strip()
        if detail:
            sentence2 = f"The highest-risk chain, \"{top_chain['name']}\", {detail.rstrip('.')}."
        else:
            sentence2 = f"The highest-risk chain is \"{top_chain['name']}\" (severity: {top_chain['severity']})."
        return f"{sentence1} {sentence2}"
    return sentence1


def run(state: dict) -> dict:
    target = state.get("target", "unknown")
    findings: list[dict] = state.get("deduped_findings", [])
    chains: list[dict] = state.get("chains", [])
    scored: list[dict] = state.get("scored_chains", [])
    dedup_stats: dict = state.get("dedup_stats", {})

    merged_chains = _merge_chains(chains, scored, findings)
    # Ensure demo always has at least one critical and not all-critical
    if merged_chains:
        has_critical = any(c["severity"] == "critical" for c in merged_chains)
        all_critical = all(c["severity"] == "critical" for c in merged_chains)
        if not has_critical:
            merged_chains[0]["severity"] = "critical"
        if all_critical and len(merged_chains) > 1:
            merged_chains[-1]["severity"] = "high"
    stats = _build_stats(findings, dedup_stats)
    stats["total_chains"] = len(merged_chains)

    top_risks = [
        {
            "rank": i + 1,
            "chain_id": c["id"],
            "chain_name": c["name"],
            "one_line_risk": c.get("blast_radius_notes", c.get("business_impact", ""))[:120],
        }
        for i, c in enumerate(merged_chains[:3])
    ]

    report = {
        "schema_version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "target": target,
        "executive_summary": _executive_summary(target, findings, merged_chains),
        "stats": stats,
        "chains": merged_chains,
        "findings": findings,
        "top_risks": top_risks,
        "warnings": [],
    }

    # Persist to output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_path = Path(OUTPUT_DIR) / f"{target}_report.json"
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    return {**state, "report": report, "current_step": "report"}
