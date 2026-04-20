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
    """Conditional routing after win_check_node."""
    if state.get("game_over"):
        winner = state.get("winner")
        return "village_wins" if winner == "village" else "mafia_wins"
    return "continue"


DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    from psycopg_pool import ConnectionPool
    from langgraph.checkpoint.postgres import PostgresSaver
    
    # Use autocommit=True for Neon/Serverless Postgres
    _pool = ConnectionPool(conninfo=DATABASE_URL, max_size=10, kwargs={"autocommit": True})
    _checkpointer = PostgresSaver(_pool)
else:
    _checkpointer = MemorySaver()


def build_graph():
    """
    Builds and compiles the LangGraph StateGraph.
    """
    # Ensure tables exist if using Postgres
    if DATABASE_URL and isinstance(_checkpointer, PostgresSaver):
        try:
            # We must use a connection from the pool to run setup
            with _pool.connection() as conn:
                _checkpointer.setup(conn)
                conn.commit() # Force the table creation to be visible globally
        except Exception as e:
            # If tables already exist, this might throw an error we can ignore
            print(f"Database setup notice: {e}")

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
