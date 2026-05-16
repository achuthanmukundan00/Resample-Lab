# Deployment

Resample-Lab is a **fully static frontend** — the entire DSP engine runs in the browser with no backend required.

---

## Quick Deploy (Cloudflare Pages)

1. Push the repo to GitHub
2. Go to **Cloudflare Dashboard → Workers & Pages → Create → Pages**
3. Connect your GitHub repository
4. Build settings:
   - **Framework preset**: None (use manual)
   - **Build command**: `cd apps/web && pnpm install && pnpm build`
   - **Build output**: `apps/web/out`
5. Deploy

That's it. No environment variables. No database. No API keys.

---

## Manual Build

```bash
git clone https://github.com/achuthanmukundan00/Resample-Lab.git
cd Resample-Lab/apps/web
pnpm install
pnpm build    # outputs static export to apps/web/out/
```

The `out/` directory is a fully self-contained static site. Serve it from any web server, S3 bucket, or CDN:

```bash
# Test locally
pnpm start

# Deploy to any static host
npx wrangler pages deploy out --branch main
```

---

## Any Static Host

Since the output is plain HTML + JS + CSS, you can deploy anywhere:

| Host | Notes |
|------|-------|
| Cloudflare Pages | Free, global CDN, auto-deploys from GitHub |
| Vercel | Free tier, configure output directory as `apps/web/out` |
| Netlify | Drag-and-drop `out/` folder or connect GitHub |
| GitHub Pages | Push `out/` to `gh-pages` branch |
| S3 + CloudFront | `aws s3 sync out/ s3://your-bucket` |
| Any web server | Copy `out/` contents to your server's document root |

No special server configuration required — no rewrites, no redirects, no SPA fallback. The app has one route (`/`) plus `/docs`, both statically generated.

---

## Why No Backend?

The original version of Resample-Lab used a Python FastAPI backend with ffmpeg + numpy/scipy for DSP. The current version runs all processing **entirely in the browser** via Web Workers. This means:

- Zero server costs
- No data ever leaves the user's machine
- Works offline after the first page load
- Instant deploy to any static host
- No rate limiting, no DDoS worries, no privacy compliance burden
