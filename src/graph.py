from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from src.state import GameState
from src.nodes.setup_node import setup_node
from src.nodes.night_mafia_node import night_mafia_node
from src.nodes.night_detective_node import night_detective_node
from src.nodes.night_medic_node import night_medic_node
from src.nodes.resolve_night_node import resolve_night_node
from src.nodes.narrator_node import narrator_node
from src.nodes.day_discussion_node import day_discussion_node
from src.nodes.vote_node import vote_node
from src.nodes.win_check_node import win_check_node

import os


def route_after_win_check(state: GameState) -> str:
    if state.get("game_over"):
        winner = state.get("winner")
        return "village_wins" if winner == "village" else "mafia_wins"
    return "continue"


DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    try:
        from psycopg_pool import ConnectionPool
        from langgraph.checkpoint.postgres import PostgresSaver

        # min_size=0: do NOT pre-open connections on startup.
        # Neon serverless pauses idle compute and kills pre-opened connections
        # with SSL errors.  Connections are opened on first use instead.
        _pool = ConnectionPool(
            conninfo=DATABASE_URL,
            min_size=0,          # no connections pre-opened — Neon cold-start safe
            max_size=10,
            max_idle=300,        # recycle after 5 min before Neon kills idle connections
            open=True,           # pool is ready; connections opened on first use (min_size=0)
            kwargs={
                "autocommit": True,
                "connect_timeout": 30,
            },
        )
        _checkpointer = PostgresSaver(_pool)
        print("Postgres checkpointer configured (lazy pool).")

    except (ModuleNotFoundError, ImportError) as e:
        print(f"WARNING: Postgres packages not available ({e}) — using MemorySaver.")
        _checkpointer = MemorySaver()
        DATABASE_URL = None
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"ERROR: Postgres init failed ({e}) — using MemorySaver.")
        _checkpointer = MemorySaver()
        DATABASE_URL = None
else:
    _checkpointer = MemorySaver()


def build_graph():
    if DATABASE_URL and hasattr(_checkpointer, "setup"):
        try:
            _checkpointer.setup()
            print("PostgresSaver setup complete (tables created/verified).")
        except Exception as e:
            print(f"Warning during PostgresSaver setup: {e}")

    builder = StateGraph(GameState)


    builder.add_node("setup", setup_node)
    builder.add_node("night_mafia", night_mafia_node)
    builder.add_node("night_detective", night_detective_node)
    builder.add_node("night_medic", night_medic_node)
    builder.add_node("resolve_night", resolve_night_node)
    builder.add_node("narrator", narrator_node)
    builder.add_node("day_discussion", day_discussion_node)
    builder.add_node("vote", vote_node)
    builder.add_node("win_check", win_check_node)

    builder.add_edge(START, "setup")
    builder.add_edge("setup", "night_mafia")
    builder.add_edge("night_mafia", "night_detective")
    builder.add_edge("night_detective", "night_medic")
    builder.add_edge("night_medic", "resolve_night")
    builder.add_edge("resolve_night", "narrator")
    builder.add_edge("narrator", "day_discussion")
    builder.add_edge("day_discussion", "vote")
    builder.add_edge("vote", "win_check")

    builder.add_conditional_edges(
        "win_check",
        route_after_win_check,
        {
            "continue": "night_mafia",
            "village_wins": END,
            "mafia_wins": END,
        },
    )

    return builder.compile(checkpointer=_checkpointer)
