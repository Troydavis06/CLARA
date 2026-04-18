"""Assemble final report from pipeline state — pure Python, no AI."""

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from ..config import OUTPUT_DIR, SEVERITY_ORDER


def _merge_chains(chains: list[dict], scored_chains: list[dict]) -> list[dict]:
    score_by_id = {s["chain_id"]: s for s in scored_chains}
    merged = []
    for c in chains:
        s = score_by_id.get(c["id"], {})
        merged.append({
            **c,
            "mitre_techniques": s.get("mitre_techniques", []),
            "fix_priority": s.get("fix_priority", 99),
            "confidence": s.get("confidence", 0.0),
            "exploitability_score": s.get("exploitability_score", 6),
            "blast_radius_notes": s.get("blast_radius_notes", ""),
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
    tools = sorted({f.get("source_tool", "") for f in findings} - {""})
    sev_counts = {}
    for f in findings:
        sev_counts[f.get("severity", "unknown")] = sev_counts.get(f.get("severity", "unknown"), 0) + 1
    critical = sev_counts.get("critical", 0)
    high = sev_counts.get("high", 0)
    summary = (
        f"CLARA analyzed {len(findings)} findings from {', '.join(tools)} "
        f"across {target}. "
        f"{critical} critical and {high} high-severity issues identified. "
        f"{len(chains)} attack chain(s) synthesized."
    )
    if top_chain:
        summary += (
            f" Highest priority: \"{top_chain['name']}\" "
            f"(severity: {top_chain['severity']}, confidence: {top_chain.get('confidence', 0):.0%})."
        )
    return summary


def run(state: dict) -> dict:
    target = state.get("target", "unknown")
    findings: list[dict] = state.get("deduped_findings", [])
    chains: list[dict] = state.get("chains", [])
    scored: list[dict] = state.get("scored_chains", [])
    dedup_stats: dict = state.get("dedup_stats", {})

    merged_chains = _merge_chains(chains, scored)
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
