# Deployment

Resample-Lab is a **fully static frontend** — the entire DSP engine runs in the browser with no backend required.
No API server, no KV, no Durable Objects, no request transformations.

---

## Canonical Deployment (Cloudflare Pages)

The app is deployed at **[rlab.watchyourtemper.com](https://rlab.watchyourtemper.com)** via a Cloudflare Pages custom domain.

### Deploy steps

1. Push the repo to GitHub
2. Go to **Cloudflare Dashboard → Workers & Pages → resample-lab → Deployments**
3. The `main` branch auto-deploys from GitHub
4. Custom domain `rlab.watchyourtemper.com` is configured under **resample-lab → Custom domains**

### Build configuration

| Setting            | Value                             |
| ------------------ | --------------------------------- |
| Framework preset   | None (manual)                     |
| Build command      | `cd apps/web && pnpm install && pnpm build` |
| Build output       | `apps/web/out`                    |
| Root directory     | (leave blank — repo root)         |

No environment variables, no `NEXT_PUBLIC_BASE_PATH`, no Worker proxy.

### Local build

```bash
cd apps/web
pnpm install
pnpm build    # outputs static export to apps/web/out/
```

The `out/` directory is a fully self-contained static site. Serve it locally to verify:

```bash
pnpm start
```

---

## Verification checklist

Before marking a deployment as complete:

- [ ] `https://rlab.watchyourtemper.com/` returns 200
- [ ] JS/CSS assets return correct MIME types (no `application/octet-stream`)
- [ ] No requests to `/rlab/_next/...` appear in the network tab
- [ ] Upload + preset generation works end-to-end
- [ ] Browser console has no MIME type or asset-loading errors

---

## Why Static?

The original version of Resample-Lab used a Python FastAPI backend with ffmpeg + numpy/scipy for DSP.
The current version runs all processing **entirely in the browser** via Web Workers. This means:

- Zero server costs
- No data ever leaves the user's machine
- Works offline after the first page load
- Instant deploy to any static host
- No rate limiting, no DDoS worries, no privacy compliance burden
