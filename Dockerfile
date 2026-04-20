FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install "psycopg[binary]" "psycopg-pool" "langgraph-checkpoint-postgres"

COPY . .

# Set environment variable defaults
ENV PORT=8080

# Use array syntax for CMD to ensure signals are handled correctly
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT}"]
