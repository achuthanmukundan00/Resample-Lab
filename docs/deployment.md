# Deployment

Resample-Lab has two independently deployable parts:

1. **Frontend** — static Next.js app, deployable to Cloudflare Pages
2. **API Backend** — Python FastAPI + ffmpeg, needs a VM/VPS or container host

---

## Frontend: Cloudflare Pages

### Prerequisites

- Node.js 18+ and pnpm
- A Cloudflare account
- (Optional) `wrangler` CLI: `npm install -g wrangler`

### Build

```bash
cd apps/web
pnpm install
pnpm build   # outputs to apps/web/out/
```

### Deploy via Wrangler

```bash
cd apps/web
npx wrangler pages deploy out --branch main
```

### Deploy via Cloudflare Dashboard

1. Go to **Cloudflare Dashboard → Workers & Pages → Create → Pages**
2. Connect your Git repository
3. Build settings:
   - Framework: Next.js (static export)
   - Build command: `cd apps/web && pnpm install && pnpm build`
   - Output directory: `apps/web/out`
4. Set environment variable:
   - `NEXT_PUBLIC_API_BASE_URL` = your production API URL
5. Deploy

### Custom Route

To serve the app at `https://yourdomain.com/resample/`:

1. In Cloudflare Dashboard, go to your domain → **Rules → Page Rules**
2. Create a rule: `yourdomain.com/resample*` → Forward to `resample-lab.pages.dev`
   - Or use **Pages → your project → Custom domains** and set the route prefix

---

## API Backend

The Python API requires:

- Python 3.9+
- numpy, scipy, soundfile, uvicorn, fastapi
- ffmpeg (system dependency)
- (Optional) PostgreSQL + Redis for job persistence

### Deploy via Docker (recommended)

```bash
cd infra/docker
docker compose up -d        # PostgreSQL + Redis
cd ../..
docker build -t resample-lab-api -f infra/Dockerfile .
docker run -d -p 8000:8000 resample-lab-api
```

### Deploy on a VPS

```bash
# Install dependencies
sudo apt install ffmpeg python3-pip
pip install -r apps/api/requirements.txt

# Run
cd apps/api
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Recommended Hosts

| Host | Type | Notes |
|------|------|-------|
| Railway | Container | Easy auto-deploy from repo |
| Fly.io | Container | Global edge, cheap for small apps |
| Render | Container/Web Service | Good free tier |
| Any VPS (Hetzner, etc.) | VM | Full control, cheapest at scale |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+psycopg2://app_user:app_password@localhost:5433/app_db` | PostgreSQL connection string (optional for basic pack generation) |
| `MAX_UPLOAD_MB` | `100` | Per-request upload size limit in MB |
| `MAX_AUDIO_DURATION` | `600` | Max per-file duration in seconds |
| `JOB_TIMEOUT` | `300` | Pack generation timeout in seconds |
| `PACK_TTL_HOURS` | `24` | Auto-cleanup age for pack directories |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins (set to your frontend URL in production) |

Set `NEXT_PUBLIC_API_BASE_URL` in Cloudflare Pages to point to your deployed API.
