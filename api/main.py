"""
main.py — FastAPI application entry point.
Run with: uvicorn api.main:app --reload
Docs at:  http://localhost:8000/docs
"""
from dotenv import load_dotenv
load_dotenv()  # Loads ANTHROPIC_API_KEY, LANGSMITH_API_KEY etc. from .env file

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes.game import router as game_router

app = FastAPI(
    title="Mafia Game API",
    description="Human-vs-LLM Mafia game powered by LangGraph and Claude.",
    version="0.1.0",
)

# CORS — allow all origins for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CORS_HEADERS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"}

# These handlers explicitly set CORS headers because FastAPI's ExceptionMiddleware
# catches errors *inside* CORSMiddleware, so headers wouldn't be added otherwise.
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=CORS_HEADERS,
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
        headers=CORS_HEADERS,
    )

app.include_router(game_router)


@app.get("/health")
def health():
    return {"status": "ok"}
