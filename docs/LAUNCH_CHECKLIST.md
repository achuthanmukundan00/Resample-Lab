# Launch Checklist — Resample-Lab v0.1

> Use this checklist before and after deploying to ensure a safe public launch.

---

## 1. Local Test Flow

- [ ] `cd apps/api && source .venv/bin/activate`
- [ ] `uvicorn app.main:app --reload` starts without errors
- [ ] `curl http://127.0.0.1:8000/health` → `{"status":"ok"}`
- [ ] Frontend `pnpm dev` builds and connects to API
- [ ] Smoke test passes: `bash apps/api/smoke-pack.sh`
- [ ] Manual: upload a short WAV, generate a pack, download + inspect ZIP
- [ ] Manual: upload unsupported format → clear error message
- [ ] Manual: upload empty file → clear error message
- [ ] Manual: upload file exceeding duration limit → clear error message

## 2. Environment Variables

- [ ] `MAX_UPLOAD_MB` set (default 100 — adjust for your infra)
- [ ] `MAX_AUDIO_DURATION` set (default 600s / 10 min)
- [ ] `JOB_TIMEOUT` set (default 300s / 5 min)
- [ ] `PACK_TTL_HOURS` set (default 24h)
- [ ] `CORS_ORIGINS` set to frontend URL (not `*` in production)
- [ ] `NEXT_PUBLIC_API_BASE_URL` set in Cloudflare Pages

## 3. Frontend Deploy (Cloudflare Pages)

- [ ] `cd apps/web && pnpm build` succeeds
- [ ] Wrangler deploy: `npx wrangler pages deploy out --branch main`
- [ ] Cloudflare dashboard URL responds
- [ ] Frontend loads without console errors
- [ ] Capabilities API call succeeds (check Network tab)
- [ ] Upload + generate works end-to-end via deployed frontend

## 4. Backend Deploy (VPS / Container)

- [ ] ffmpeg installed on the server
- [ ] Python deps installed (`pip install -r apps/api/requirements.txt`)
- [ ] Server firewall allows port 8000 (or reverse proxy)
- [ ] Reverse proxy (nginx/Caddy) configured with rate limiting
- [ ] HTTPS enabled (LetsEncrypt / Caddy auto-TLS)
- [ ] API health check passes: `curl https://api.example.com/health`
- [ ] File upload + pack generation returns 201
- [ ] Download endpoint serves valid ZIP
- [ ] DELETE endpoint returns 204

## 5. Abuse Limits (Hardening)

| Limit | Where | Default | Tune |
|-------|-------|---------|------|
| Upload size | `MAX_UPLOAD_MB` | 100 MB | Lower to 20 MB if storage/cpu is constrained |
| Audio duration | `MAX_AUDIO_DURATION` | 600 s (10 min) | Lower to 120 s for faster processing |
| Job timeout | `JOB_TIMEOUT` | 300 s (5 min) | Matches max expected processing time |
| Pack TTL | `PACK_TTL_HOURS` | 24 h | Lower to 1 h for high-traffic public instances |
| CORS | `CORS_ORIGINS` | `*` | **Must** set to your frontend URL in production |

### Rate Limiting (recommended for production)

Add at the reverse-proxy layer:

- nginx `limit_req_zone` — e.g., 10 req/min per IP for `/api/packs` POST
- Caddy `rate_limit` directive
- Cloudflare WAF rate-limiting rules if proxied through Cloudflare

## 6. Pre-Launch Smoke Test

```bash
# From the repo root:
cd apps/api
source .venv/bin/activate

# Start server in background
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
SERVER_PID=$!
sleep 2

# Run smoke test
API_URL=http://localhost:8000 bash smoke-pack.sh

# Stop server
kill $SERVER_PID
```

## 7. Monitoring (Post-Launch)

- [ ] Watch API logs for 5xx errors
- [ ] Watch for `413 Payload Too Large` — clients hitting upload ceiling
- [ ] Watch for timeout errors in background jobs
- [ ] Check disk usage — stale packs older than `PACK_TTL_HOURS` are cleaned on restart
