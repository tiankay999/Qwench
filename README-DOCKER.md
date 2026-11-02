# Qwench Docker Deployment Guide

This directory contains the production-ready Docker and Docker Compose configuration for the full Qwench platform:
- **`mongo`**: MongoDB database with persistent volume storage (`mongo_data`).
- **`backend`**: Node.js/Express Core API & Regulatory Evidence Engine (Port 4000).
- **`webapp`**: Next.js 16 Web Application & Qwench Console (Port 3000).
- **`whatsapp-bot`**: Baileys WhatsApp client with persistent credential storage (`whatsapp_auth`).
- **`telegram-bot`**: Lightweight native Node.js Telegram bot.

---

## 1. Quick Start

### Step 1: Prepare Environment File
Copy the docker environment template to `.env` in the root directory:
```bash
cp .env.docker.example .env
```

Generate strong 32-byte (64 hex characters) secrets for security keys:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Fill in the generated secrets for:
- `PHONE_HASH_SALT`
- `HMAC_SECRET_KEY`
- `JWT_SECRET`
- `CHANNEL_API_KEY` (shared key between backend and bots)

### Step 2: Build and Launch Containers
```bash
docker compose up -d --build
```

Verify that all containers are healthy:
```bash
docker compose ps
```

---

## 2. Linking the WhatsApp Bot

The WhatsApp bot container runs Baileys and saves its session credentials into the persistent named volume `whatsapp_auth`.

To view the QR code and link your device:
```bash
docker compose logs -f whatsapp-bot
```
1. Open **WhatsApp** on your phone.
2. Tap **Settings** (or three dots `⋮`) > **Linked devices** > **Link a device**.
3. Scan the QR code displayed in the logs terminal.

> [!NOTE]
> Once paired, your credentials remain saved in the `whatsapp_auth` Docker volume across container restarts and redeployments without needing to scan again.

---

## 3. Database Seeding & Admin Tools

To populate the initial regulatory registers (SEC Ghana, BoG sandbox) or run seeds inside the running backend container:

```bash
# Seed initial data
docker compose exec backend npm run seed

# Import reviewed regulatory records
docker compose exec backend npm run import:reviewed

# Create an initial console admin user
docker compose exec backend npm run user:create
```

To backup the MongoDB database:
```bash
docker compose exec mongo mongodump --db=qwench --out=/data/db/backup-$(date +%Y%m%d)
```

---

## 4. Running Specific Services

You do not need to run every service simultaneously on a single server. You can specify only the services you need:

### Backend and Database Only (API server):
```bash
docker compose up -d mongo backend
```

### Web App + Backend + Database:
```bash
docker compose up -d mongo backend webapp
```

### Bots Only (pointing to an external backend):
```bash
docker compose up -d whatsapp-bot telegram-bot
```

---

## 5. Production Reverse Proxy (Nginx / SSL)

When deploying to a public server (VPS, Cloud VM, DigitalOcean, Hetzner, AWS), place a reverse proxy like Nginx or Caddy in front of ports 3000 and 4000.

### Example Caddyfile:
```caddy
# Web App & Console
qwench.yourdomain.com {
    reverse_proxy localhost:3000
}

# Public API
api.yourdomain.com {
    reverse_proxy localhost:4000
}
```

### Example Nginx Configuration:
```nginx
server {
    listen 80;
    server_name qwench.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 6. Useful Maintenance Commands

| Task | Command |
|---|---|
| View real-time logs | `docker compose logs -f [service_name]` |
| Restart a specific service | `docker compose restart [service_name]` |
| Rebuild after code change | `docker compose up -d --build [service_name]` |
| Stop all containers | `docker compose down` |
| Stop and wipe volumes (Reset) | `docker compose down -v` |

