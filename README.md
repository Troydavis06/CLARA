# CLARA — Contextual Layered Analysis for Risk & Remediation

Hook'em Hacks 2026 · Security analysis tool that turns raw scanner JSON into prioritized attack chains using a LangGraph AI pipeline (Gemini).

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env          # add your GEMINI_API_KEY
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 · Select a target · Click Analyze

## Demo Mode
Toggle **Demo mode** in the UI to replay pre-baked results — no Gemini API calls, instant response.

Generate golden files after first successful run:
```bash
cd backend
python -c "
from pipeline.config import TARGETS
from pipeline.graph import get_graph
import json
from pathlib import Path

graph = get_graph()
for target, cfg in TARGETS.items():
    state = graph.invoke({'target': target, 'target_config': cfg, 'error': None, 'retry_count': 0, 'current_step': 'ingest'})
    Path(f'../data/demo/golden/{target}.json').write_text(json.dumps(state['report'], indent=2))
    print(f'Generated golden/{target}.json')
"
```

## Architecture
```
React (Vite/Tailwind) ──SSE──► FastAPI ──invoke──► LangGraph
                                         ingest → dedup → cluster(Gemini) →
                                         synthesize(Gemini, streaming) →
                                         mitre_prioritize(Gemini) → report
```

## Targets
| Target     | Stack           | Scan Types          |
|------------|-----------------|---------------------|
| pygoat     | Python/Django   | Bandit + ZAP + OSV  |
| juice-shop | Node.js/Angular | ZAP + npm audit     |
| impacket   | Python library  | Bandit + OSV        |
