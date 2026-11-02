# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production

# Telegram bot uses native Node.js 22 built-ins (fetch, Buffer, AbortSignal)
COPY package.json ./
COPY src ./src

USER node

CMD ["node", "src/index.js"]

