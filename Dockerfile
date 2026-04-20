FROM python:3.11-slim

# Install system dependencies for Postgres (needed for psycopg[binary])
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# Install base requirements
RUN pip install --no-cache-dir -r requirements.txt

# Add postgres checkpointer support
RUN pip install "psycopg[binary]" "psycopg-pool" "langgraph-checkpoint-postgres" "langgraph"

COPY . .

# Cloud Run uses port 8080 by default
EXPOSE 8080

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8080"]
