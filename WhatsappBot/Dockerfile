# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
WORKDIR /app

# Install curl for connectivity check
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV AUTH_DIR=/app/auth

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy application source
COPY src ./src

# Create auth directory with proper permissions for persistent session data
RUN mkdir -p /app/auth && chown -R node:node /app

USER node

# Mount point for Baileys WhatsApp authentication credentials
VOLUME ["/app/auth"]

CMD ["node", "src/index.js"]

