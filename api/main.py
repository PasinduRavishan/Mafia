import os
import sys

# Ensure the root directory is in the python path so 'api' and 'src' can be found
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.getcwd())

from dotenv import load_dotenv
load_dotenv()

print("--- CLOUD RUN STARTUP ---")
print(f"DATABASE_URL present: {'Yes' if os.environ.get('DATABASE_URL') else 'No'}")
print(f"ANTHROPIC_API_KEY present: {'Yes' if os.environ.get('ANTHROPIC_API_KEY') else 'No'}")
print(f"Listening on Port: {os.environ.get('PORT', '8080')}")
print("-------------------------")

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
