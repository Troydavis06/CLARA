"""Unified LLM interface supporting both Gemini and Ollama."""

import logging
import os
import time

# Configure logger — uvicorn will pick this up automatically
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("clara.llm")

# Import backends conditionally
try:
    from google import genai
    from google.genai import errors, types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False
    log.warning("google-genai not installed — Gemini unavailable")

try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False

try:
    from groq import Groq as GroqClient
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    log.warning("groq not installed — Groq fallback unavailable")

GROQ_MODEL = "llama-3.3-70b-versatile"


def _extract_json(text: str) -> str:
    """Strip markdown fences and extract the first JSON object/array from text."""
    import re
    # Remove ```json ... ``` or ``` ... ``` fences
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fenced:
        return fenced.group(1).strip()
    # Find the outermost { } or [ ]
    for open_c, close_c in [('{', '}'), ('[', ']')]:
        start = text.find(open_c)
        if start == -1:
            continue
        end = text.rfind(close_c)
        if end > start:
            return text[start:end + 1]
    return text


def get_llm_provider() -> str:
    return os.environ.get("LLM_PROVIDER", "gemini").lower()


def get_llm_model() -> str:
    provider = get_llm_provider()
    if provider == "ollama":
        return os.environ.get("OLLAMA_MODEL", "llama3.2")
    return os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")


def _get_groq_keys() -> list[str]:
    """Return all configured Groq API keys in priority order."""
    key_names = ["GROQ_API_KEY", "GROQ_API_KEY_PRAT", "GROQ_API_KEY_SRI", "GROQ_API_KEY_NIKHIL"]
    return [v.strip() for name in key_names if (v := os.environ.get(name, "")).strip()]


def _generate_groq(prompt: str, system: str, temperature: float, api_key: str) -> str:
    import json as _json
    prompt_preview = prompt[:80].replace("\n", " ")
    log.info(f"  → Groq request  model={GROQ_MODEL}  prompt_chars={len(prompt)}  \"{prompt_preview}...\"")
    t0 = time.time()
    try:
        client = GroqClient(api_key=api_key)
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ]
        for attempt in range(2):
            completion = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                temperature=temperature,
            )
            raw = completion.choices[0].message.content
            result = _extract_json(raw)
            try:
                _json.loads(result)
                elapsed = time.time() - t0
                log.info(f"  ✓ Groq OK  model={GROQ_MODEL}  elapsed={elapsed:.1f}s  response_chars={len(result)}")
                return result
            except _json.JSONDecodeError as je:
                if attempt == 0:
                    log.warning(f"  ✗ Groq returned invalid JSON, retrying with correction prompt: {je}")
                    messages.append({"role": "assistant", "content": raw})
                    messages.append({"role": "user", "content": f"Your response was not valid JSON. Error: {je}. Please respond with only valid JSON, no markdown fences or extra text."})
                else:
                    raise ValueError(f"Groq returned invalid JSON after retry: {je}") from je
    except Exception as e:
        elapsed = time.time() - t0
        log.error(f"  ✗ Groq FAILED  model={GROQ_MODEL}  elapsed={elapsed:.1f}s  error={e}")
        raise
    return ""


def _generate_groq_with_rotation(prompt: str, system: str, temperature: float) -> str:
    """Try all configured Groq API keys in sequence until one succeeds."""
    keys = _get_groq_keys()
    if not keys:
        raise ValueError("No Groq API keys configured")
    last_err: Exception | None = None
    for i, key in enumerate(keys):
        try:
            log.info(f"  ↓ Trying Groq key #{i+1}/{len(keys)}...")
            return _generate_groq(prompt, system, temperature, key)
        except Exception as e:
            log.warning(f"  ✗ Groq key #{i+1} failed: {e}")
            last_err = e
    raise RuntimeError(f"All {len(keys)} Groq keys failed. Last error: {last_err}")


def generate_with_backoff(
    prompt: str,
    system: str,
    temperature: float = 0.0,
    max_attempts: int = 4,
) -> str:
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
    if not OLLAMA_AVAILABLE:
        raise ImportError("ollama package not installed")

    for attempt in range(max_attempts):
        prompt_preview = prompt[:80].replace("\n", " ")
        log.info(f"  → Ollama request  model={model}  attempt={attempt+1}/{max_attempts}  \"{prompt_preview}...\"")
        t0 = time.time()
        try:
            response = ollama.chat(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                options={"temperature": temperature},
                format="json",
            )
            result = response["message"]["content"]
            elapsed = time.time() - t0
            log.info(f"  ✓ Ollama OK  model={model}  elapsed={elapsed:.1f}s  response_chars={len(result)}")
            return result
        except Exception as e:
            elapsed = time.time() - t0
            if "not found" in str(e).lower():
                log.warning(f"  ↓ Ollama model not found, pulling {model}...")
                ollama.pull(model)
                continue
            elif attempt < max_attempts - 1:
                wait = 5 * (2 ** attempt)
                log.warning(f"  ✗ Ollama FAILED  elapsed={elapsed:.1f}s  error={e}  retrying in {wait}s...")
                time.sleep(wait)
            else:
                log.error(f"  ✗ Ollama FAILED (final)  elapsed={elapsed:.1f}s  error={e}")
                raise
    return ""


def _generate_gemini(
    prompt: str,
    system: str,
    temperature: float,
    max_attempts: int,
    model: str,
) -> str:
    if not GEMINI_AVAILABLE:
        raise ImportError("google-generativeai package not installed")

    vertex_project = os.environ.get("VERTEX_PROJECT_ID")
    vertex_location = os.environ.get("VERTEX_LOCATION", "us-central1")

    if vertex_project:
        client = genai.Client(vertexai=True, project=vertex_project, location=vertex_location)
        backend = f"Vertex AI ({vertex_location})"
    else:
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VERTEX_API_KEY")
        if not api_key:
            raise ValueError("Either GEMINI_API_KEY/VERTEX_API_KEY or VERTEX_PROJECT_ID must be set")
        client = genai.Client(api_key=api_key)
        backend = "Gemini API"

    groq_keys = _get_groq_keys()
    use_groq_fallback = GROQ_AVAILABLE and bool(groq_keys)

    for attempt in range(max_attempts):
        prompt_preview = prompt[:80].replace("\n", " ")
        log.info(f"  → Gemini request  backend={backend}  model={model}  attempt={attempt+1}/{max_attempts}  prompt_chars={len(prompt)}  \"{prompt_preview}...\"")
        t0 = time.time()
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",
                    temperature=temperature,
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                ),
            )
            elapsed = time.time() - t0
            log.info(f"  ✓ Gemini OK  model={model}  elapsed={elapsed:.1f}s  response_chars={len(resp.text)}")
            return resp.text
        except errors.ClientError as e:
            elapsed = time.time() - t0
            if "429" in str(e):
                # Rate limit — retry with backoff, then fall back to Groq
                if attempt < max_attempts - 1:
                    wait = 30 * (2 ** attempt)
                    log.warning(f"  ✗ Gemini rate-limited (429)  elapsed={elapsed:.1f}s  retrying in {wait}s...")
                    time.sleep(wait)
                elif use_groq_fallback:
                    log.warning(f"  ✗ Gemini rate-limited (429, final)  elapsed={elapsed:.1f}s")
                    log.info("  ↓ Falling back to Groq rotation...")
                    return _generate_groq_with_rotation(prompt, system, temperature)
                else:
                    log.error(f"  ✗ Gemini rate-limited (final, no Groq)  elapsed={elapsed:.1f}s  error={e}")
                    raise
            else:
                # Non-429 client error — immediately try Groq
                log.warning(f"  ✗ Gemini ClientError  elapsed={elapsed:.1f}s  error={e}")
                if use_groq_fallback:
                    log.info("  ↓ Falling back to Groq rotation immediately...")
                    return _generate_groq_with_rotation(prompt, system, temperature)
                elif attempt < max_attempts - 1:
                    wait = 5 * (attempt + 1)
                    log.warning(f"  ↓ No Groq available, retrying Gemini in {wait}s...")
                    time.sleep(wait)
                else:
                    log.error(f"  ✗ Gemini ClientError (final, no Groq)  elapsed={elapsed:.1f}s  error={e}")
                    raise
        except Exception as e:
            elapsed = time.time() - t0
            # Any non-client error — immediately try Groq
            log.warning(f"  ✗ Gemini error  elapsed={elapsed:.1f}s  error={e}")
            if use_groq_fallback:
                log.info("  ↓ Falling back to Groq rotation immediately...")
                return _generate_groq_with_rotation(prompt, system, temperature)
            elif attempt < max_attempts - 1:
                wait = 5 * (attempt + 1)
                log.warning(f"  ↓ No Groq available, retrying Gemini in {wait}s...")
                time.sleep(wait)
            else:
                log.error(f"  ✗ Gemini FAILED (final, no Groq)  elapsed={elapsed:.1f}s  error={e}")
                raise
    return ""


# Backwards compatibility
def get_client():
    if get_llm_provider() == "gemini":
        if not GEMINI_AVAILABLE:
            raise ImportError("google-generativeai package not installed")
        vertex_project = os.environ.get("VERTEX_PROJECT_ID")
        if vertex_project:
            return genai.Client(
                vertexai=True,
                project=vertex_project,
                location=os.environ.get("VERTEX_LOCATION", "us-central1"),
            )
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("VERTEX_API_KEY")
        if not api_key:
            raise ValueError("Either GEMINI_API_KEY/VERTEX_API_KEY or VERTEX_PROJECT_ID must be set")
        return genai.Client(api_key=api_key)
    return None


def default_model() -> str:
    return get_llm_model()
