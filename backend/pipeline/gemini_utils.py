"""LLM client helper — supports Gemini and Ollama via LLM_PROVIDER env var."""

import json
import os
import time
import urllib.request


# ---------------------------------------------------------------------------
# Routing helpers
# ---------------------------------------------------------------------------

def _provider() -> str:
    return os.environ.get("LLM_PROVIDER", "gemini").lower()


# ---------------------------------------------------------------------------
# Gemini helpers
# ---------------------------------------------------------------------------

def _gemini_client():
    from google import genai
    
    # Check if using Vertex AI (project ID specified)
    vertex_project = os.environ.get("VERTEX_PROJECT_ID")
    vertex_location = os.environ.get("VERTEX_LOCATION", "us-central1")
    
    if vertex_project:
        # Use Vertex AI
        return genai.Client(
            vertexai=True,
            project=vertex_project,
            location=vertex_location,
        )
    else:
        # Use Gemini API with API key
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VERTEX_API_KEY")
        if not api_key:
            raise ValueError("Either GEMINI_API_KEY/VERTEX_API_KEY or VERTEX_PROJECT_ID must be set")
        return genai.Client(api_key=api_key)


def _gemini_generate(client, model: str, prompt: str, system: str, temperature: float = 0.0) -> str:
    from google.genai import types
    resp = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            temperature=temperature,
        ),
    )
    return resp.text


def _gemini_generate_with_backoff(client, model: str, prompt: str, system: str, max_attempts: int = 4) -> str:
    from google.genai import errors
    for attempt in range(max_attempts):
        try:
            return _gemini_generate(client, model, prompt, system)
        except errors.ClientError as e:
            if "429" in str(e) and attempt < max_attempts - 1:
                time.sleep(30 * (2 ** attempt))
            else:
                raise
    return ""


# ---------------------------------------------------------------------------
# Ollama helpers
# ---------------------------------------------------------------------------

def _ollama_generate(model: str, prompt: str, system: str) -> str:
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
    payload = json.dumps({
        "model": model,
        "prompt": prompt,
        "system": system,
        "stream": False,
        "format": "json",
    }).encode()
    req = urllib.request.Request(
        f"{base_url}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=300) as resp:
        result = json.loads(resp.read())
    return result["response"]


# ---------------------------------------------------------------------------
# Public API — same interface as before, provider-transparent
# ---------------------------------------------------------------------------

def get_client():
    if _provider() == "ollama":
        return None  # Ollama uses HTTP directly, no client object
    return _gemini_client()


def default_model() -> str:
    if _provider() == "ollama":
        return os.environ.get("OLLAMA_MODEL", "llama3.2")
    return os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")


def generate_with_backoff(client, model: str, prompt: str, system: str, max_attempts: int = 4) -> str:
    if _provider() == "ollama":
        for attempt in range(max_attempts):
            try:
                return _ollama_generate(model, prompt, system)
            except Exception as e:
                if attempt < max_attempts - 1:
                    time.sleep(5 * (attempt + 1))
                else:
                    raise
        return ""
    return _gemini_generate_with_backoff(client, model, prompt, system, max_attempts)


def stream_with_backoff(client, model: str, prompt: str, system: str, temperature: float = 0.2, max_attempts: int = 4) -> str:
    # Ollama streaming not needed for pipeline — use same generate path
    return generate_with_backoff(client, model, prompt, system, max_attempts)
