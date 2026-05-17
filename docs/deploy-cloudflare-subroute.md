# Deploying Resample-Lab under watchyourtemper.com/rlab

This document describes the two Cloudflare resources and the exact steps to serve Resample-Lab at `https://watchyourtemper.com/rlab`.

---

## Architecture

```
User → watchyourtemper.com/rlab/*
         ↓
  [Cloudflare Worker: watchyourtemper-rlab-proxy]
         ↓  strips /rlab, proxies upstream
  [Resample-Lab Cloudflare Pages] ← static Next.js export
```

The Worker sits on the watchyourtemper.com zone, intercepts `/rlab` paths, strips the prefix, and forwards to the Resample-Lab Pages project. The Pages project builds a standard Next.js static export — it has no knowledge of the subpath.

---

## A. Resample-Lab Cloudflare Pages

**Dashboard:** Cloudflare Dashboard → Workers & Pages → Resample-Lab Pages project

| Setting                | Value                          |
| ---------------------- | ------------------------------ |
| Framework preset       | None (manual)                  |
| Build command          | `pnpm build`                   |
| Build output directory | `out`                          |
| Root directory         | (leave blank — uses repo root) |

**Environment variable (must be set in Pages dashboard):**

| Name                    | Value   |
| ----------------------- | ------- |
| `NEXT_PUBLIC_BASE_PATH` | `/rlab` |

**Deploy:** Push to the connected GitHub branch, or manually:

```bash
NEXT_PUBLIC_BASE_PATH=/rlab pnpm build
npx wrangler pages deploy out --branch main
```

---

## B. Cloudflare Worker: watchyourtemper-rlab-proxy

### Dashboard setup

1. Go to **Cloudflare Dashboard → Workers & Pages → Create → Worker**
2. Name: `watchyourtemper-rlab-proxy`
3. Deploy the code from `infra/rlab-worker/src/index.js`
4. Go to the Worker's **Triggers** tab → **Routes**
5. Add route: `watchyourtemper.com/rlab*`

### Deploy from CLI

```bash
cd infra/rlab-worker
npx wrangler deploy
```

> ⚠️ **Critical:** Always deploy from `infra/rlab-worker/`, never from the repo root. Deploying from root makes Cloudflare detect the monorepo/Python project structure, causing it to run `pip install .`, which fails because setuptools discovers conflicting top-level packages (`apps`, `infra`, `alembic`, `node_modules`).

### Dry run (no-op check)

```bash
cd infra/rlab-worker
npx wrangler deploy --dry-run
```

---

## Worker source code

**File:** `infra/rlab-worker/src/index.js`

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Redirect /rlab → /rlab/
    if (url.pathname === "/rlab") {
      url.pathname = "/rlab/";
      return Response.redirect(url.toString(), 308);
    }

    // Handle /rlab/... → proxy to Pages origin
    if (url.pathname.startsWith("/rlab/")) {
      const target = new URL(request.url);
      target.protocol = "https";
      target.hostname = "YOUR-RESAMPLE-LAB-PAGES-DOMAIN.pages.dev";
      target.pathname = target.pathname.replace(/^\/rlab/, "") || "/";
      return fetch(new Request(target.toString(), request));
    }

    // Pass through all other requests
    return fetch(request);
  },
};
```

**TODO:** Replace `YOUR-RESAMPLE-LAB-PAGES-DOMAIN` with the actual Cloudflare Pages project URL (e.g. `resample-lab-abc123.pages.dev`).

---

## Verification

### After Pages redeploy (before Worker is live)

```bash
cd apps/web
NEXT_PUBLIC_BASE_PATH=/rlab pnpm build
```

Check the output:

- `grep -r '/rlab/_next/static/' out/` → finds references
- `ls out/_next/static/` → directory exists (not in `out/rlab/`)
- `ls out/wyt-logo.png` → static asset exists at root

### After Worker deploy

Test these URLs:

| URL                                             | Expected result       |
| ----------------------------------------------- | --------------------- |
| `https://watchyourtemper.com/rlab/`             | Resample-Lab loads    |
| `https://watchyourtemper.com/rlab`              | Redirects to `/rlab/` |
| `https://watchyourtemper.com/rlab/wyt-logo.png` | Logo image            |
| `https://watchyourtemper.com/rlab/docs`         | Documentation page    |

In browser DevTools **Network** tab, verify:

- `/rlab/_next/static/...` → 200 (not 404)
- `/rlab/wyt-logo.png` → 200
- No requests incorrectly go to `/_next/static/...` (would bypass the Worker)
- Web Worker bundle loads successfully
- Upload + generate flow works entirely in the browser

---

## Risks & gotchas

- **Deploy from wrong directory:** Deploying the Worker from the repo root triggers Python dependency detection, causing a `pip install` failure. Always `cd infra/rlab-worker` first.
- **Placeholder origin:** The Worker code contains a placeholder `YOUR-RESAMPLE-LAB-PAGES-DOMAIN.pages.dev`. This **must** be replaced with the actual Pages project URL before the Worker will function.
- **Route precedence:** The Worker route `watchyourtemper.com/rlab*` must not conflict with any existing routes on the watchyourtemper.com zone. If there's already a catch-all Worker, ensure this route takes priority.
- **Static export only:** This setup assumes `output: "export"` in Next.js config. If that changes (e.g. to `output: "standalone"`), the Worker proxy logic will need updating.
- **No backend:** All DSP runs in the browser via a Web Worker. There is no API server behind this route — don't add backend logic to the proxy.
- **Cache:** The Worker does not add any caching headers. Cloudflare's edge cache will respect the Pages origin's Cache-Control headers. If assets are stale, check the Pages project's caching settings.
- **Zone-level route vs. Worker-only route:** The route `watchyourtemper.com/rlab*` in `wrangler.toml` may not be deployable from a `npx wrangler deploy` without `zone_id` configured. If the dashboard shows the route but traffic does not reach the Worker, verify the route is listed under the Worker's **Triggers** tab.
