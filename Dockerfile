FROM node:18-alpine

LABEL org.opencontainers.image.title="Memora"
LABEL org.opencontainers.image.description="The first Pearl inter-agent memory layer in the Olas ecosystem"
LABEL org.opencontainers.image.url="https://memora.codes"
LABEL org.opencontainers.image.source="https://github.com/khusna-memora/memora"

# Pearl standard port
EXPOSE 8716

WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci --production && npm cache clean --force

# Copy source
COPY src/ ./src/
COPY run.sh ./
RUN chmod +x run.sh

# Create data dir
RUN mkdir -p /app/data

# Pearl env vars
ENV PORT=8716 \
    NODE_ENV=production \
    DB_PATH=/app/data/memora.db \
    CONNECTION_CONFIGS_CONFIG_STORE_PATH=/app/data

# Health check (Pearl polls this)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8716/healthcheck | grep -q '"is_healthy":true' || exit 1

# ENTRYPOINT — Pearl passes --password arg
ENTRYPOINT ["./run.sh"]
