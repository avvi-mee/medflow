"""Async LLM client wrapper — OpenAI client pointed at Groq API."""
import json
import asyncio
from typing import Optional, Dict, Any

from openai import AsyncOpenAI

from config import settings


_client: Optional[AsyncOpenAI] = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
        )
    return _client


async def call_llm(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.1,
    json_mode: bool = True,
    max_tokens: int = 2048,
) -> str:
    """Call Groq LLM via OpenAI-compatible client. Returns raw response string."""
    client = get_client()
    kwargs: Dict[str, Any] = {
        "model": settings.groq_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content or ""


async def call_llm_json(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.1,
    max_tokens: int = 2048,
) -> Dict[str, Any]:
    """Call LLM and parse JSON response. Returns dict."""
    raw = await call_llm(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        json_mode=True,
        max_tokens=max_tokens,
    )
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract JSON from response
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
        raise ValueError(f"Could not parse JSON from LLM response: {raw[:200]}")
