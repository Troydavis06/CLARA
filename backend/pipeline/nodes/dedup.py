"""Deduplicate normalized findings (pure Python, no AI).

Two findings are duplicates if they share:
  - The same CWE AND same location AND same tool category (SAST/DAST/OSS)

Keeps the higher-severity entry and merges source_targets.
"""

from ..config import SEVERITY_ORDER

_TOOL_CATEGORY = {
    "bandit": "SAST",
    "zap": "DAST",
    "npm-audit": "OSS",
    "osv-scanner": "OSS",
}


def _sev_rank(sev: str) -> int:
    try:
        return SEVERITY_ORDER.index(sev)
    except ValueError:
        return len(SEVERITY_ORDER)


def _dedup_key(f: dict) -> tuple | None:
    cwe = tuple(sorted(f.get("cwe") or []))
    if not cwe:
        return None  # no CWE → can't do semantic dedup, keep as-is
    category = _TOOL_CATEGORY.get(f["source_tool"], "OTHER")
    location = f.get("location", "")
    return (cwe, location, category)


def run(state: dict) -> dict:
    findings: list[dict] = state.get("normalized_findings", [])
    seen: dict[tuple, dict] = {}
    no_key: list[dict] = []

    for f in findings:
        key = _dedup_key(f)
        if key is None:
            no_key.append(f)
            continue
        if key not in seen:
            seen[key] = dict(f)
            seen[key]["_sources"] = [f["source_target"]]
        else:
            existing = seen[key]
            # Keep higher severity
            if _sev_rank(f["severity"]) < _sev_rank(existing["severity"]):
                existing["severity"] = f["severity"]
            # Merge source targets
            if f["source_target"] not in existing["_sources"]:
                existing["_sources"].append(f["source_target"])

    deduped = list(seen.values()) + no_key
    stats = {
        "raw": len(findings),
        "duplicates_removed": len(findings) - len(deduped),
        "unique": len(deduped),
    }
    return {**state, "deduped_findings": deduped, "dedup_stats": stats, "current_step": "dedup"}
