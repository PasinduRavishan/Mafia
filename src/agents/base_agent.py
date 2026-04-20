"""
base_agent.py — LLM call infrastructure.

LLM SWAP GUIDE (change LLM_PROVIDER below):
  "claude"  — Anthropic Claude (requires ANTHROPIC_API_KEY)
  "gemini"  — Google Gemini Flash FREE tier (requires GOOGLE_API_KEY from aistudio.google.com)
  "groq"    — Groq Llama 3.3 70B FREE tier (requires GROQ_API_KEY from console.groq.com)

To switch: change LLM_PROVIDER, install the corresponding package, add the API key to .env.
"""
import json
import re
import time

from langchain_core.messages import HumanMessage, SystemMessage

# ── LLM provider config — change this to switch models ────────────────────────
LLM_PROVIDER = "claude"   # "claude" | "gemini" | "groq"

# Lazy singleton
_llm = None


def _get_llm():
    global _llm
    if _llm is not None:
        return _llm

    if LLM_PROVIDER == "claude":
        from langchain_anthropic import ChatAnthropic
        _llm = ChatAnthropic(model="claude-sonnet-4-6", temperature=0.8)

    elif LLM_PROVIDER == "gemini":
        # pip install langchain-google-genai
        # Get free API key: https://aistudio.google.com/
        from langchain_google_genai import ChatGoogleGenerativeAI
        _llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.8)

    elif LLM_PROVIDER == "groq":
        # pip install langchain-groq
        # Get free API key: https://console.groq.com/
        from langchain_groq import ChatGroq
        _llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.8)

    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {LLM_PROVIDER}")

    return _llm


def call_agent(system_prompt: str, user_context: dict, max_retries: int = 3) -> str:
    """
    Calls the configured LLM with a system prompt + game context.
    Retries up to max_retries times on overload/rate-limit errors (with backoff).
    """
    context_text = format_context_for_prompt(user_context)
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=context_text),
    ]

    last_error = None
    for attempt in range(max_retries):
        try:
            response = _get_llm().invoke(messages)
            return response.content

        except Exception as e:
            last_error = e
            err_str = str(e).lower()

            # Retry on overload / rate limit / 5xx errors
            is_retriable = any(x in err_str for x in [
                "overloaded", "529", "rate_limit", "429",
                "503", "502", "resource_exhausted",
            ])

            if is_retriable and attempt < max_retries - 1:
                wait = (attempt + 1) * 6   # 6s, 12s, 18s
                print(f"[base_agent] LLM overloaded (attempt {attempt+1}). Retrying in {wait}s...")
                time.sleep(wait)
                global _llm
                _llm = None   # Reset singleton so a new connection is made
                continue

            raise

    raise last_error  # type: ignore


def format_context_for_prompt(context: dict) -> str:
    lines = ["=== CURRENT GAME CONTEXT ==="]
    for key, value in context.items():
        if key == "is_human":
            continue
        if isinstance(value, list):
            formatted = ", ".join(str(v) for v in value) if value else "none"
        elif isinstance(value, dict):
            formatted = "empty" if not value else "; ".join(f"{k}={v}" for k, v in value.items())
        else:
            formatted = str(value) if value is not None else "none"
        lines.append(f"{key.upper()}: {formatted}")
    return "\n".join(lines)


def parse_json_response(response: str) -> dict:
    try:
        return json.loads(response.strip())
    except json.JSONDecodeError:
        pass

    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    match = re.search(r"\{.*?\}", response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from LLM response: {response[:200]}")
