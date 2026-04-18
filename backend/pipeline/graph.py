"""LangGraph StateGraph for the CLARA pipeline."""

from langgraph.graph import StateGraph, END

from .state import PipelineState
from .nodes import ingest, dedup, cluster, synthesize, mitre_prioritize, report


def _error_or_next(next_node: str):
    """Route to next_node normally, or to 'error_terminal' if state has an error."""
    def router(state: PipelineState) -> str:
        if state.get("error"):
            return "error_terminal"
        return next_node
    return router


def _error_terminal(state: PipelineState) -> PipelineState:
    return state


def build_graph() -> any:
    g = StateGraph(PipelineState)

    g.add_node("ingest",            ingest.run)
    g.add_node("dedup",             dedup.run)
    g.add_node("cluster",           cluster.run)
    g.add_node("synthesize",        synthesize.run)
    g.add_node("mitre_prioritize",  mitre_prioritize.run)
    g.add_node("report",            report.run)
    g.add_node("error_terminal",    _error_terminal)

    g.set_entry_point("ingest")
    g.add_edge("ingest", "dedup")
    g.add_edge("dedup", "cluster")
    g.add_conditional_edges("cluster",         _error_or_next("synthesize"),
                            {"synthesize": "synthesize", "error_terminal": "error_terminal"})
    g.add_conditional_edges("synthesize",      _error_or_next("mitre_prioritize"),
                            {"mitre_prioritize": "mitre_prioritize", "error_terminal": "error_terminal"})
    g.add_edge("mitre_prioritize", "report")
    g.add_edge("report", END)
    g.add_edge("error_terminal", END)

    return g.compile()


# Singleton compiled graph
_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph
