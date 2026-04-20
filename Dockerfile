FROM python:3.11-slim

RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install "psycopg[binary]" "psycopg-pool" "langgraph-checkpoint-postgres"

COPY . .

# Use the PORT environment variable provided by Cloud Run
CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8080}
