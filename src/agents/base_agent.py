"""
base_agent.py — LangChain + Claude LLM call infrastructure.

This is the ONLY place in the codebase that talks to the Claude API.
All NPC nodes call call_agent() with a filled prompt + their filtered state view.

LangChain concepts used here:
- ChatAnthropic: the LLM model wrapper for Claude
- SystemMessage: the agent's "persona" and instructions (stays constant)
- HumanMessage: the current game context (changes each turn)
- .invoke(): sends the messages to the API and returns the response
"""
import json
import re

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import HumanMessage, SystemMessage

# Lazy singleton — created on first call so ANTHROPIC_API_KEY is already loaded
_llm: ChatAnthropic | None = None


def _get_llm() -> ChatAnthropic:
    global _llm
    if _llm is None:
        _llm = ChatAnthropic(model="claude-sonnet-4-6", temperature=0.8)
    return _llm


def call_agent(system_prompt: str, user_context: dict) -> str:
    """
    Calls the Claude LLM with a system prompt + game context.
    Returns the raw text response.

    system_prompt: the agent's role instructions (from prompts.py)
    user_context:  the filtered state view from build_agent_view()
    """
    context_text = format_context_for_prompt(user_context)

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=context_text),
    ]

    response = _get_llm().invoke(messages)
    return response.content


def format_context_for_prompt(context: dict) -> str:
    """
    Converts the agent view dict into a readable text block for the prompt.
    Lists and dicts are formatted clearly so the LLM can parse them easily.
    """
    lines = ["=== CURRENT GAME CONTEXT ==="]
    for key, value in context.items():
        if key == "is_human":
            continue  # Internal flag — not shown to LLM
        if isinstance(value, list):
            formatted = ", ".join(str(v) for v in value) if value else "none"
        elif isinstance(value, dict):
            if not value:
                formatted = "empty"
            else:
                formatted = "; ".join(f"{k}={v}" for k, v in value.items())
        else:
            formatted = str(value) if value is not None else "none"
        lines.append(f"{key.upper()}: {formatted}")
    return "\n".join(lines)


def parse_json_response(response: str) -> dict:
    """
    Extracts and parses a JSON object from the LLM's response.
    LLMs sometimes wrap JSON in markdown code blocks or add extra text —
    this handles those cases robustly.
    """
    # Try direct parse first
    try:
        return json.loads(response.strip())
    except json.JSONDecodeError:
        pass

    # Try to extract JSON from markdown code block
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Try to find any JSON object in the response
    match = re.search(r"\{.*?\}", response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not parse JSON from LLM response: {response[:200]}")
