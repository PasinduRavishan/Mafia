"""
day_discussion_node.py — All living players speak during the day phase.

Order: NPCs speak first (in alive_player_ids order), then human speaks last.
This gives the human the most information before they have to commit to a statement.

Each NPC gets a role-appropriate day prompt. The LLM returns 2-4 sentences of dialogue.
The human's turn uses interrupt() — graph pauses, FastAPI returns the prompt, human types
their statement via POST /game/{id}/action, graph resumes.

discussion_turns_left bounds how many full rounds of discussion happen per day.
Default is 1 (each player speaks once per day).
"""
from langgraph.types import interrupt

from src.agents.base_agent import call_agent
from src.state import GameState
from src.utils.prompts import (
    DETECTIVE_DAY_PROMPT,
    MAFIA_DAY_PROMPT,
    MEDIC_DAY_PROMPT,
    VILLAGER_DAY_PROMPT,
)
from src.utils.state_views import build_agent_view

# Map role → day prompt template
ROLE_TO_DAY_PROMPT = {
    "mafia": MAFIA_DAY_PROMPT,
    "detective": DETECTIVE_DAY_PROMPT,
    "medic": MEDIC_DAY_PROMPT,
    "villager": VILLAGER_DAY_PROMPT,
}


def day_discussion_node(state: GameState) -> dict:
    if state["discussion_turns_left"] <= 0:
        return {"phase": "vote"}

    new_statements = []
    new_log = []

    # NPCs speak first — gives human the most context before they reply
    for pid in state["alive_player_ids"]:
        if pid == "human":
            continue  # Human goes last

        player = state["all_players"][pid]
        view = build_agent_view(pid, state)
        role = player["role"]

        prompt_template = ROLE_TO_DAY_PROMPT[role]
        prompt = prompt_template.format(
            your_player_id=view["your_player_id"],
            your_personality=view["your_personality"],
            round_number=view["round_number"],
            alive_players=", ".join(view["alive_players"]),
            public_log="\n".join(view["public_log"][-15:]),
            day_statements=_format_statements(view["day_statements"]),
            # Role-specific extras
            mafia_teammates=view.get("mafia_teammates", []),
            investigation_ledger=view.get("investigation_ledger", {}),
        )

        statement = call_agent(prompt, view)
        statement = statement.strip()

        new_statements.append({"player_id": pid, "statement": statement})
        new_log.append(f"[{pid}]: {statement}")

    # Human speaks last — interrupt() pauses the graph here
    if "human" in state["alive_player_ids"]:
        view = build_agent_view("human", state)

        # Build a rich context message for the human
        npc_summary = "\n".join(
            f"  {s['player_id']}: {s['statement']}"
            for s in (state["day_statements"] + new_statements)
        )

        human_statement = interrupt({
            "type": "day_statement",
            "message": (
                f"=== Day {state['round_number']} Discussion ===\n"
                f"Alive players: {', '.join(state['alive_player_ids'])}\n\n"
                f"What others said:\n{npc_summary or 'No one has spoken yet.'}\n\n"
                "What do you say to the village? (2-4 sentences)"
            ),
            "options": None,
            "npc_statements": new_statements,  # Pass so frontend can animate them before asking human
        })

        human_statement = human_statement.strip()
        new_statements.append({"player_id": "human", "statement": human_statement})
        new_log.append(f"[You]: {human_statement}")

    return {
        "phase": "vote",
        "day_statements": state["day_statements"] + new_statements,
        "public_log": new_log,
        "discussion_turns_left": state["discussion_turns_left"] - 1,
    }


def _format_statements(statements: list[dict]) -> str:
    if not statements:
        return "No statements yet."
    return "\n".join(f"{s['player_id']}: {s['statement']}" for s in statements)
