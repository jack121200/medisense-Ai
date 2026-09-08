FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# --extra-index-url is needed for the torch==...+cpu build (deep_anomaly.py's
# ECG autoencoder) — plain PyPI doesn't host CPU-only torch wheels.
RUN pip install --no-cache-dir -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

COPY . .

RUN mkdir -p /app/models

# Runs as root by default otherwise — python:3.11-slim has no pre-made
# unprivileged user the way node:alpine/nginx:alpine do, so this creates
# one explicitly. Port 8000 isn't privileged, so no port change is needed
# (unlike the frontend's nginx container, which had to move off port 80).
RUN useradd --create-home --shell /bin/false appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
