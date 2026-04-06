"""
night_medic_node.py — Medic chooses one player to protect from the Mafia's kill.

If the Mafia's target == medic_save → resolve_night_node returns None (no death).
The medic does NOT know if the Mafia targeted the same player they saved.

Self-heal rule: medic can protect themselves, but only once per game.
"""
from langgraph.types import interrupt

from src.agents.base_agent import call_agent, parse_json_response
from src.state import GameState, NightActions
from src.utils.prompts import MEDIC_NIGHT_PROMPT
from src.utils.state_views import build_agent_view


def night_medic_node(state: GameState) -> dict:
    # Find the medic (if alive)
    medic_id = next(
        (pid for pid, p in state["all_players"].items()
         if p["role"] == "medic" and p["is_alive"]),
        None
    )

    if medic_id is None:
        return {}  # No medic in this game or medic is dead

    player = state["all_players"][medic_id]

    # Valid save targets: all alive players
    # Self-heal exclusion if already used
    valid_targets = [
        pid for pid in state["alive_player_ids"]
        if not (pid == medic_id and state["medic_self_heal_used"])
    ]

    if player["is_human"]:
        # ── HUMAN MEDIC ──
        view = build_agent_view(medic_id, state)
        target = interrupt({
            "type": "night_action",
            "message": (
                "You are the MEDIC. Choose one player to protect tonight. "
                "If the Mafia targets them, they will survive.\n"
                f"Self-heal already used: {state['medic_self_heal_used']}"
            ),
            "options": valid_targets,
        })
    else:
        # ── NPC MEDIC ──
        view = build_agent_view(medic_id, state)
        prompt = MEDIC_NIGHT_PROMPT.format(
            your_player_id=view["your_player_id"],
            medic_self_heal_used=view.get("medic_self_heal_used", False),
            round_number=view["round_number"],
            alive_players=view["alive_players"],
            public_log="\n".join(view["public_log"][-10:]),
        )
        response = call_agent(prompt, view)
        result = parse_json_response(response)
        target = result.get("target", "")

    # Validate target
    if target not in valid_targets:
        import random
        target = random.choice(valid_targets) if valid_targets else None

    # Track self-heal usage
    medic_self_heal_used = state["medic_self_heal_used"]
    if target == medic_id:
        medic_self_heal_used = True

    night_actions = dict(state["night_actions"])
    night_actions["medic_save"] = target

    return {
        "night_actions": NightActions(**night_actions),
        "medic_self_heal_used": medic_self_heal_used,
    }
