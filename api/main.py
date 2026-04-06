"""
main.py — FastAPI application entry point.
Run with: uvicorn api.main:app --reload
Docs at:  http://localhost:8000/docs
"""
from dotenv import load_dotenv
load_dotenv()  # Loads ANTHROPIC_API_KEY, LANGSMITH_API_KEY etc. from .env file

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.game import router as game_router

app = FastAPI(
    title="Mafia Game API",
    description="Human-vs-LLM Mafia game powered by LangGraph and Claude.",
    version="0.1.0",
)

# CORS — allow all origins for local development
# Restrict this in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(game_router)


@app.get("/health")
def health():
    return {"status": "ok"}
