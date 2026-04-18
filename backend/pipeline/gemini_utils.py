"""Shared Gemini client helper with automatic 429 backoff."""

import os
import time

from google import genai
from google.genai import errors, types


def get_client() -> genai.Client:
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def default_model() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")


def generate_with_backoff(
    client: genai.Client,
    model: str,
    prompt: str,
    system: str,
    max_attempts: int = 4,
) -> str:
    """Call generate_content with exponential backoff on 429 rate limits."""
    for attempt in range(max_attempts):
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",
                    temperature=0.0,
                ),
            )
            return resp.text
        except errors.ClientError as e:
            if "429" in str(e) and attempt < max_attempts - 1:
                wait = 30 * (2 ** attempt)  # 30s, 60s, 120s
                time.sleep(wait)
            else:
                raise


def stream_with_backoff(
    client: genai.Client,
    model: str,
    prompt: str,
    system: str,
    temperature: float = 0.2,
    max_attempts: int = 4,
) -> str:
    """Stream generate_content with exponential backoff on 429. Returns full text."""
    for attempt in range(max_attempts):
        try:
            full_text = ""
            for chunk in client.models.generate_content_stream(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",
                    temperature=temperature,
                ),
            ):
                if chunk.text:
                    full_text += chunk.text
            return full_text
        except errors.ClientError as e:
            if "429" in str(e) and attempt < max_attempts - 1:
                wait = 30 * (2 ** attempt)
                time.sleep(wait)
            else:
                raise
    return ""
