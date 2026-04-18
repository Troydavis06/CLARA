from typing import TypedDict


class PipelineState(TypedDict, total=False):
    target: str
    target_config: dict
    raw_data: dict                  # {sast: [...], dast: [...], oss: [...]}
    normalized_findings: list[dict]
    deduped_findings: list[dict]
    dedup_stats: dict               # {raw, duplicates_removed, unique}
    clusters: dict                  # {surface: {finding_ids: [], count: int}}
    chains: list[dict]              # from synthesize
    scored_chains: list[dict]       # from mitre_prioritize
    report: dict                    # final assembled report
    error: str | None
    retry_count: int
    current_step: str               # for SSE progress events
