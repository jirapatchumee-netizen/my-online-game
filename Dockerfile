# ─────────────────────────────────────────────────────────────────
# Dockerfile – Nebula AI: Rogue Defender
# Unified image: FastAPI backend + static frontend served on one port.
# Compatible with Railway (reads $PORT environment variable).
# ─────────────────────────────────────────────────────────────────

# 1. Base Image — lightweight Python 3.11
FROM python:3.11-slim

# 2. Labels
LABEL maintainer="Nebula AI Dev"
LABEL description="Nebula AI: Rogue Defender – FastAPI backend + static frontend"

# 3. Working Directory
WORKDIR /app

# 4. Install Python dependencies
#    Copy requirements first to exploit Docker layer caching.
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copy backend source
COPY backend/app.py ./backend/app.py

# 6. Copy frontend static assets
COPY frontend/ ./frontend/

# 7. Expose the default development port (Railway overrides via $PORT)
EXPOSE 8000

# 8. Start the server on port 8000
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
