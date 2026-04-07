# Monorepo Starter (Next.js + FastAPI + RQ)

A minimal full-stack monorepo with:

* **Frontend**: Next.js (App Router, TypeScript)
* **Backend**: FastAPI
* **Worker**: RQ (Redis Queue)
* **Infra**: Redis + Postgres via Docker Compose

Designed for fast local setup and clean extensibility.

---

## 📁 Project Structure

```
apps/
  web/       # Next.js frontend
  api/       # FastAPI backend
  worker/    # RQ worker
infra/
  docker/    # Docker Compose (Redis + Postgres)
```

---

## ⚙️ Prerequisites

Install the following:

* **Node.js** (v20+)
* **pnpm**
* **Python** (3.9–3.11 recommended)
* **Docker Desktop** (must be running)

Verify:

```bash
node -v
pnpm -v
python3 --version
docker info
```

---

## 🚀 Quick Start (Fresh Clone)

### 1. Clone and install frontend deps

```bash
git clone <your-repo-url>
cd <repo-name>
pnpm install
```

---

### 2. Copy environment file

```bash
cp .env.example .env
```

---

### 3. Start local infrastructure (Redis + Postgres)

```bash
cd infra/docker
docker-compose up -d
cd ../..
```

Verify:

```bash
docker ps
```

You should see Redis (6379) and Postgres (5432).

---

### 4. Run frontend (Next.js)

```bash
pnpm dev
```

Open:

```
http://localhost:3000
```

---

### 5. Run backend (FastAPI)

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload
```

Test:

```bash
curl http://127.0.0.1:8000/health
```

Expected:

```json
{"status":"ok"}
```

---

### 6. Run worker (RQ)

```bash
cd apps/worker
python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
python worker.py
```

Expected output:

```
RQ worker started...
Listening on default...
```

---

## ✅ Verification Checklist

All acceptance criteria should pass:

* [ ] `docker-compose up` starts Redis + Postgres
* [ ] `pnpm dev` runs frontend
* [ ] `uvicorn` runs API
* [ ] Worker connects to Redis without error
* [ ] `/health` returns 200

---

## 🌐 Services Overview

| Service  | URL / Port            |
| -------- | --------------------- |
| Frontend | http://localhost:3000 |
| API      | http://localhost:8000 |
| Redis    | localhost:6379        |
| Postgres | localhost:5432        |

---

## 🔧 Environment Variables

See `.env.example`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

REDIS_URL=redis://localhost:6379/0

POSTGRES_DB=app_db
POSTGRES_USER=app_user
POSTGRES_PASSWORD=app_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

---

## 🧹 Formatting & Linting

### Frontend

```bash
pnpm lint
pnpm format
```

---

### Python (API + Worker)

```bash
black apps/api apps/worker
isort apps/api apps/worker
```

---

## 🐳 Docker Notes

* Uses **Redis 7 (alpine)**
* Uses **Postgres 16 (alpine)**
* Data persisted via Docker volume

Stop services:

```bash
cd infra/docker
docker-compose down
```

---

## ⚠️ Common Issues

### Docker not running

Error:

```
failed to connect to docker.sock
```

Fix:

* Open Docker Desktop
* Wait until it's fully started
* Run `docker info`

---

### Redis connection refused

Error:

```
Error 61 connecting to localhost:6379
```

Fix:

```bash
docker-compose up -d
```

---

### Port already in use

Fix by stopping conflicting services or changing ports in `docker-compose.yml`.

---

## 📄 License

MIT License
