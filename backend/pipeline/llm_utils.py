"""Unified LLM interface supporting both Gemini and Ollama."""

import os
import time
import json
from typing import Optional

# Import backends conditionally
try:
    from google import genai
    from google.genai import errors, types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False


def get_llm_provider() -> str:
    """Get the configured LLM provider from environment."""
    return os.environ.get("LLM_PROVIDER", "gemini").lower()


def get_llm_model() -> str:
    """Get the configured model name."""
    provider = get_llm_provider()
    if provider == "ollama":
        return os.environ.get("OLLAMA_MODEL", "llama3.2")
    else:
        return os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")


def generate_with_backoff(
    prompt: str,
    system: str,
    temperature: float = 0.0,
    max_attempts: int = 4,
) -> str:
    """
    Generate text using the configured LLM backend.
    Automatically handles retries and backoff.
    """
    provider = get_llm_provider()
    model = get_llm_model()
    
    if provider == "ollama":
        return _generate_ollama(prompt, system, temperature, max_attempts, model)
    elif provider == "gemini":
        return _generate_gemini(prompt, system, temperature, max_attempts, model)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")


def _generate_ollama(
    prompt: str,
    system: str,
    temperature: float,
    max_attempts: int,
    model: str,
) -> str:
    """Generate using Ollama backend."""
    if not OLLAMA_AVAILABLE:
        raise ImportError("ollama package not installed")
    
    for attempt in range(max_attempts):
        try:
            response = ollama.chat(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                options={
                    "temperature": temperature,
                },
                format="json",  # Request JSON response
            )
            return response["message"]["content"]
        except Exception as e:
            if "not found" in str(e).lower():
                # Model not pulled yet
                print(f"Pulling Ollama model {model}...")
                ollama.pull(model)
                continue
            elif attempt < max_attempts - 1:
                wait = 5 * (2 ** attempt)
                print(f"Ollama error (attempt {attempt + 1}/{max_attempts}): {e}. Retrying in {wait}s...")
                time.sleep(wait)
            else:
                raise
    return ""


def _generate_gemini(
    prompt: str,
    system: str,
    temperature: float,
    max_attempts: int,
    model: str,
) -> str:
    """Generate using Gemini backend (supports both API and Vertex AI)."""
    if not GEMINI_AVAILABLE:
        raise ImportError("google-generativeai package not installed")
    
    # Check if using Vertex AI (project ID specified)
    vertex_project = os.environ.get("VERTEX_PROJECT_ID")
    vertex_location = os.environ.get("VERTEX_LOCATION", "us-central1")
    
    if vertex_project:
        # Use Vertex AI
        client = genai.Client(
            vertexai=True,
            project=vertex_project,
            location=vertex_location,
        )
    else:
        # Use Gemini API with API key
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VERTEX_API_KEY")
        if not api_key:
            raise ValueError("Either GEMINI_API_KEY/VERTEX_API_KEY or VERTEX_PROJECT_ID must be set")
        client = genai.Client(api_key=api_key)
    
    for attempt in range(max_attempts):
        try:
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
        except errors.ClientError as e:
            if "429" in str(e) and attempt < max_attempts - 1:
                wait = 30 * (2 ** attempt)
                print(f"Gemini rate limit (attempt {attempt + 1}/{max_attempts}). Retrying in {wait}s...")
                time.sleep(wait)
            else:
                raise
    return ""


# Backwards compatibility: expose the old interface
def get_client():
    """Legacy function for backwards compatibility."""
    if get_llm_provider() == "gemini":
        if not GEMINI_AVAILABLE:
            raise ImportError("google-generativeai package not installed")
        
        # Check if using Vertex AI
        vertex_project = os.environ.get("VERTEX_PROJECT_ID")
        vertex_location = os.environ.get("VERTEX_LOCATION", "us-central1")
        
        if vertex_project:
            return genai.Client(
                vertexai=True,
                project=vertex_project,
                location=vertex_location,
            )
        else:
            api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VERTEX_API_KEY")
            if not api_key:
                raise ValueError("Either GEMINI_API_KEY/VERTEX_API_KEY or VERTEX_PROJECT_ID must be set")
            return genai.Client(api_key=api_key)
    else:
        # Return a dummy object for Ollama since it doesn't need a client
        return None


def default_model() -> str:
    """Legacy function for backwards compatibility."""
    return get_llm_model()
