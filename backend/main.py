"""FastAPI backend for CLARA — SSE streaming pipeline."""

import asyncio
import json
import os
from pathlib import Path

# Load .env from this directory before anything else
_env = Path(__file__).parent / ".env"
if _env.exists():
    for line in _env.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from pipeline.config import GOLDEN_DIR, TARGETS
from pipeline.graph import get_graph

app = FastAPI(title="CLARA API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory run store — sufficient for hackathon single-user use
_runs: dict[str, dict] = {}


class AnalyzeRequest(BaseModel):
    target: str
    demo: bool = False
    uploaded_files: list[dict] | None = None


@app.get("/targets")
def list_targets():
    return [
        {
            "id": key,
            "context": cfg["context"],
            "stack": cfg["stack"],
            "tools": [
                t for t, k in [("bandit", "sast"), ("zap", "dast"), ("osv/npm", "oss")]
                if cfg.get(k)
            ],
        }
        for key, cfg in TARGETS.items()
    ]


@app.post("/analyze")
async def start_analysis(req: AnalyzeRequest):
    if req.uploaded_files:
        # Custom upload mode — no target validation needed
        run_id = str(uuid.uuid4())
        _runs[run_id] = {
            "status": "pending",
            "target": req.target or "custom",
            "demo": False,
            "report": None,
            "uploaded_files": req.uploaded_files,
        }
        return {"run_id": run_id}
    if req.target not in TARGETS:
        raise HTTPException(status_code=400, detail=f"Unknown target '{req.target}'")
    run_id = str(uuid.uuid4())
    _runs[run_id] = {"status": "pending", "target": req.target, "demo": req.demo, "report": None}
    return {"run_id": run_id}


@app.get("/analyze/{run_id}/stream")
async def stream_run(run_id: str):
    run = _runs.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    target = run["target"]
    demo = run["demo"]

    async def event_generator():
        def sse(event_type: str, data: dict) -> str:
            return f"data: {json.dumps({'type': event_type, **data})}\n\n"

        if demo:
            golden_path = Path(GOLDEN_DIR) / f"{target}.json"
            if golden_path.exists():
                report = json.loads(golden_path.read_text(encoding="utf-8"))
                run["report"] = report
                run["status"] = "complete"
                yield sse("complete", {"report": report})
                return
            else:
                # Golden file doesn't exist - generate it on first run
                yield sse("step_start", {"step": "generate_golden", "label": "Generating demo cache (first run)..."})
                # Fall through to real pipeline run below, which will cache the result

        # Real pipeline run
        steps = ["ingest", "dedup", "cluster", "synthesize", "mitre_prioritize", "report"]
        step_labels = {
            "ingest": "Ingesting scanner data",
            "dedup": "Deduplicating findings",
            "cluster": "Clustering by attack surface",
            "synthesize": "Synthesizing attack chains",
            "mitre_prioritize": "Mapping MITRE ATT&CK + prioritizing",
            "report": "Generating report",
        }

        target_config = TARGETS[target]
        initial_state = {
            "target": target,
            "target_config": target_config,
            "error": None,
            "retry_count": 0,
            "current_step": "ingest",
        }

        graph = get_graph()
        run["status"] = "running"

        # Run graph steps, yielding SSE events as each node completes
        # LangGraph stream(mode="updates") yields {node_name: state_updates} dicts
        try:
            step_num = 0
            accumulated_state = dict(initial_state)
            state = accumulated_state
            for chunk in graph.stream(initial_state, stream_mode="updates"):
                node_name = list(chunk.keys())[0]
                accumulated_state.update(chunk[node_name])
                state = accumulated_state
                step_num += 1
                label = step_labels.get(node_name, node_name)
                yield sse("step_start", {"step": node_name, "label": label,
                                         "step_num": step_num, "total": len(steps)})

                if state.get("error"):
                    yield sse("error", {"step": node_name, "message": state["error"]})
                    run["status"] = "error"
                    return

                # Build summary for this step
                summary = ""
                if node_name == "ingest":
                    n = len(state.get("normalized_findings", []))
                    summary = f"{n} findings loaded"
                elif node_name == "dedup":
                    s = state.get("dedup_stats", {})
                    summary = f"{s.get('unique', '?')} unique findings ({s.get('duplicates_removed', 0)} duplicates removed)"
                elif node_name == "cluster":
                    clusters = state.get("clusters", {})
                    non_empty = sum(1 for v in clusters.values() if v.get("count", 0) > 0)
                    summary = f"{non_empty} clusters identified"
                elif node_name == "synthesize":
                    n = len(state.get("chains", []))
                    summary = f"{n} attack chains synthesized"
                elif node_name == "mitre_prioritize":
                    summary = "chains scored and ranked"
                elif node_name == "report":
                    summary = "report complete"

                yield sse("step_complete", {"step": node_name, "result_summary": summary})

                # After synthesize, also stream the narrative text for the frontend typewriter effect
                if node_name == "synthesize":
                    for chain in state.get("chains", []):
                        yield sse("chain_preview", {
                            "chain_id": chain["id"],
                            "name": chain["name"],
                            "severity": chain["severity"],
                            "narrative_preview": chain.get("narrative", "")[:300],
                        })

                await asyncio.sleep(0)  # yield control to event loop

            final_state = state  # last state from stream
            report = final_state.get("report", {})
            run["report"] = report
            run["status"] = "complete"
            
            # Cache golden file for demo mode if requested
            if demo:
                golden_path = Path(GOLDEN_DIR) / f"{target}.json"
                golden_path.parent.mkdir(parents=True, exist_ok=True)
                golden_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
            
            yield sse("complete", {"report": report})

        except Exception as e:
            run["status"] = "error"
            yield sse("error", {"step": "unknown", "message": str(e)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/analyze/{run_id}/result")
def get_result(run_id: str):
    run = _runs.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    if run["status"] != "complete":
        raise HTTPException(status_code=202, detail=f"Run status: {run['status']}")
    return run["report"]
