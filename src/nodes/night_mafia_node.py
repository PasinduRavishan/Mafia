"""
night_mafia_node.py — Mafia player chooses their kill target for the night.

LangGraph interrupt pattern:
- If the Mafia player IS the human → interrupt() pauses the graph and returns
  a prompt to FastAPI. The graph resumes when the human POSTs their target.
- If the Mafia player is an NPC → call the LLM, parse JSON response, continue.
"""
from langgraph.types import interrupt

from src.agents.base_agent import call_agent, parse_json_response
from src.state import GameState, NightActions
from src.utils.prompts import MAFIA_NIGHT_PROMPT
from src.utils.state_views import build_agent_view


def night_mafia_node(state: GameState) -> dict:
    # Find the Mafia player(s) who are still alive
    mafia_ids = [
        pid for pid, p in state["all_players"].items()
        if p["role"] == "mafia" and p["is_alive"]
    ]

    if not mafia_ids:
        # No living Mafia (shouldn't happen mid-game, but safe fallback)
        return {}

    # For simplicity: one lead Mafia decides (handles multi-Mafia games)
    mafia_id = mafia_ids[0]
    player = state["all_players"][mafia_id]

    # Valid targets: alive players who are not Mafia
    valid_targets = [
        pid for pid in state["alive_player_ids"]
        if state["all_players"][pid]["alignment"] != "mafia"
    ]

    if player["is_human"]:
        # ── HUMAN TURN ──
        # interrupt() pauses the graph here. FastAPI will return this payload
        # to the frontend. When the human submits POST /game/{id}/action,
        # FastAPI calls graph.invoke(Command(resume=target)), and execution
        # continues from this exact line with target = what the human chose.
        view = build_agent_view(mafia_id, state)
        mafia_teammates = view.get("mafia_teammates", [])
        target = interrupt({
            "type": "night_action",
            "message": (
                f"You are MAFIA. Your teammates: {mafia_teammates or 'none (solo Mafia)'}. "
                "Choose one player to eliminate tonight. They must not be your teammate."
            ),
            "options": valid_targets,
        })
    else:
        # ── NPC TURN ──
        view = build_agent_view(mafia_id, state)
        # Format the prompt template with this agent's view
        prompt = MAFIA_NIGHT_PROMPT.format(
            your_player_id=view["your_player_id"],
            mafia_teammates=view.get("mafia_teammates", []),
            round_number=view["round_number"],
            alive_players=view["alive_players"],
            public_log="\n".join(view["public_log"][-10:]),  # Last 10 entries to save tokens
            your_personality=view["your_personality"],
        )
        response = call_agent(prompt, view)
        result = parse_json_response(response)
        target = result.get("target", "")

    # Validate target (safety check)
    if target not in valid_targets:
        # Fallback: pick a random valid target rather than crash
        import random
        target = random.choice(valid_targets) if valid_targets else None

    night_actions = dict(state["night_actions"])
    night_actions["mafia_target"] = target

    return {
        "night_actions": NightActions(**night_actions),
        "public_log": [
            "  [Night] The Mafia opens their eyes and silently selects a target...",
            "  [Night] The Mafia closes their eyes.",
        ],
    }
