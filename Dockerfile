# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /build
# Vite reads VITE_* env vars at build time. Forward the API key so the
# bundled SPA can authenticate to mutating routes once GENESIS_API_KEY is
# enforced on the backend.
ARG VITE_GENESIS_API_KEY=""
ENV VITE_GENESIS_API_KEY=$VITE_GENESIS_API_KEY
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python runtime
FROM python:3.11-slim
WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Copy built frontend
COPY --from=frontend-build /build/dist /app/static

# Create data directory
RUN mkdir -p /app/data/worlds

# Add static file serving to FastAPI
ENV DATA_DIR=/app/data/worlds
ENV HOST=0.0.0.0
ENV PORT=8003

EXPOSE 8003
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
