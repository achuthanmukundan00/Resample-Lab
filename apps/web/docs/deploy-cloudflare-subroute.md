# Deploying Resample-Lab under `watchyourtemper.com/rlab`

This guide documents two complementary deployment options for the Resample-Lab
frontend, which is a **fully static Next.js export** with all DSP running locally
in a Web Worker (no backend).

---

## Architecture Overview

```
                  watchyourtemper.com
                  ┌──────────────────────────┐
                  │  Cloudflare Pages Site    │
                  │  (main site)              │
                  │                           │
                  │  Worker route:            │
                  │  /rlab  ──proxy──┐        │
                  └──────────────────┼────────┘
                                     │
                  resample.watchyourtemper.com  (or *.pages.dev)
                  ┌──────────────────┼────────┐
                  │  Cloudflare Pages │        │
                  │  (Resample-Lab)   │        │
                  │                   ▼        │
                  │  Built with NEXT_PUBLIC_BASE_PATH=/rlab
                  │  Serves static export      │
                  └────────────────────────────┘
```

---

## Option A (Recommended): `watchyourtemper.com/rlab`

The app is built **with `basePath: "/rlab"`** so all routes and assets are
prefixed. The main `watchyourtemper.com` site uses a Cloudflare Worker to
proxy requests from `/rlab/*` to the Resample-Lab Pages deployment.

### Step 1 — Build the app with subpath

```bash
cd apps/web
NEXT_PUBLIC_BASE_PATH=/rlab pnpm build
```

The generated HTML files reference all assets with the `/rlab/` prefix
(e.g., `<img src="/rlab/wyt-logo.png">`, `<script src="/rlab/_next/static/chunks/...">`).
The Next.js `basePath` setting rewrites all asset URLs and Link hrefs, and the
build-time `assetPath()` helper prepends the prefix for `public/` assets like
the logo.

**Critical**: The build output stays at `apps/web/out/` root — NOT in an
`out/rlab/` subdirectory. The files `out/index.html`, `out/wyt-logo.png`,
and `out/_next/static/chunks/*` remain exactly where they are. Only the
URLs *within* the HTML change. The Cloudflare Worker (set up in Step 3)
must strip `/rlab` when proxying so the upstream Pages origin serves
from its root. See the explanation below.

### Step 2 — Deploy to Resample-Lab Pages project

```bash
npx wrangler pages deploy out --branch main
```

Or set `NEXT_PUBLIC_BASE_PATH` in the Cloudflare dashboard under
**Pages → resample-lab → Settings → Environment variables → Production**:

| Variable name            | Value  |
|--------------------------|--------|
| `NEXT_PUBLIC_BASE_PATH`  | `/rlab`|

Then trigger a redeploy from the dashboard or via `git push`.

### Step 3 — Add the proxying Worker to `watchyourtemper.com`

In the **main** Cloudflare project (the one serving `watchyourtemper.com`),
create a Worker with the following code:

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/rlab") {
      url.pathname = "/rlab/";
      return Response.redirect(url.toString(), 308);
    }

    if (url.pathname.startsWith("/rlab/")) {
      const frontendOrigin = new URL("https://YOUR-RESAMPLE-LAB-PAGES-DOMAIN.pages.dev");

      const target = new URL(request.url);
      target.protocol = frontendOrigin.protocol;
      target.hostname = frontendOrigin.hostname;
      target.port = frontendOrigin.port;

      // Critical: the Next.js static export does NOT create an out/rlab/
      // subdirectory. All files live at the root of out/ (index.html,
      // _next/static/chunks/*, wyt-logo.png, etc.). The basePath setting
      // only prefixes URLs in the generated HTML with /rlab/.
      //
      // The browser sends /rlab/_next/static/chunk.js to watchyourtemper.com,
      // the Worker strips /rlab, and proxies to the Pages origin which
      // serves the file from its root at /_next/static/chunk.js.
      //
      // See: docs/deploy-cloudflare-subroute.md#why-the-worker-must-strip-rlab
      target.pathname = target.pathname.replace(/^\/rlab/, "") || "/";

      return fetch(new Request(target.toString(), request));
    }

    return fetch(request);
  },
};
```

**Important**: Replace `YOUR-RESAMPLE-LAB-PAGES-DOMAIN.pages.dev` with your actual
Pages deployment URL.

### Step 4 — Set the Worker route

In the Cloudflare dashboard for `watchyourtemper.com`:

1. Go to **Workers & Pages → your-worker → Triggers → Routes**
2. Add route: `watchyourtemper.com/rlab*`
3. Deploy

---

## Option B (Optional): `resample.watchyourtemper.com`

Set up a standalone custom subdomain pointing directly at the Resample-Lab
Pages project. This is useful as a direct fallback URL — it does not involve
a proxy Worker.

### Step 1 — Build (root-based, no subpath)

```bash
cd apps/web
pnpm build
```

Do **not** set `NEXT_PUBLIC_BASE_PATH`. The app serves from `/`.

### Step 2 — Add custom domain in Cloudflare

1. Go to **Pages → resample-lab → Custom domains**
2. Add `resample.watchyourtemper.com`
3. Cloudflare automatically provisions the DNS record and TLS cert

### Step 3 — Deploy

```bash
npx wrangler pages deploy out --branch main
```

Now `https://resample.watchyourtemper.com` serves the app from root — all
routes and assets resolve correctly without any `basePath`.

---

## Why the Worker must strip `/rlab`

Next.js `basePath` with `output: "export"` does **not** move files into a
subdirectory. The build output layout looks like this:

```
out/                         ← Cloudflare Pages serves from root (/) of the domain
  index.html                 ← Browser path: /rlab/       → Worker strips → Pages serves /
  docs.html                  ← Browser path: /rlab/docs   → Worker strips → Pages serves /docs
  wyt-logo.png               ← Browser path: /rlab/wyt-logo.png → Worker strips → Pages serves /
  _next/static/chunks/*.js   ← Browser path: /rlab/_next/static/chunks/*.js → Worker strips
  favicon.ico
```

The generated `index.html` references assets with the `/rlab/` prefix because
of `basePath`. When a browser loads `watchyourtemper.com/rlab/`, it gets
`index.html` which says `<img src="/rlab/wyt-logo.png">`. The browser then
requests `watchyourtemper.com/rlab/wyt-logo.png`, which the Worker catches,
strips `/rlab`, and proxies to the Pages origin at `/wyt-logo.png`.

If the Worker kept the `/rlab/` prefix, the upstream Pages origin would
receive `/rlab/wyt-logo.png` and return 404 — because the file lives at the
root of `out/`, not under `out/rlab/`.

## Testing

After whichever option(s) you deploy, verify in the browser:

| URL | Expectation |
|-----|-------------|
| `https://watchyourtemper.com/rlab/` | App loads, worker JS loads (check Network tab) |
| `https://watchyourtemper.com/rlab/docs` | Docs page loads |
| `https://resample.watchyourtemper.com/` | App loads at root (if using Option B) |

Upload an audio file, generate a pack, and download the ZIP — the entire
pipeline must work locally with no failed network requests.

---

## How it works

- **Next.js `basePath`**: When `NEXT_PUBLIC_BASE_PATH=/rlab`, Next.js prepends
  `/rlab` to all generated asset URLs and Link hrefs in the HTML. The static
  export output still lives at `out/` root on disk — the prefix only exists in
  the HTML references. The Worker at `watchyourtemper.com` strips this prefix
  when proxying to the Pages deployment, which serves assets from root.
- **`public/` assets**: Referenced via `assetPath('/wyt-logo.png')`, which
  prepends the `NEXT_PUBLIC_BASE_PATH` value at build time. On a root-based
  build the same helper returns the bare path.
- **Web Worker**: Created via `new URL(..., import.meta.url)`, a bundler-level
  relative import. Next.js emits the worker chunk under `_next/static/chunks/`,
  which inherits the `basePath` prefix in the generated HTML. The browser loads
  the worker from `/rlab/_next/static/chunks/...` → Worker strips prefix →
  Pages serves from `/_next/static/chunks/...`.
- **API stubs**: The `lib/api.ts` module is unused in the current local-only
  flow. Its `fetch()` calls target `window.location.origin`, so they won't
  accidentally hit `/rlab/api/...` because no code calls them.
- **Proxy flow**: Browser → `watchyourtemper.com/rlab/` → Worker strips `/rlab`
  → proxies to `resample-lab-xxx.pages.dev/`. The served HTML references
  `/rlab/...` asset paths, which the browser fetches from `watchyourtemper.com`,
  hitting the same Worker each time (matching the `rlab*` route).

---

## Risks and gotchas

- **Separate builds**: Option A (subpath) and Option B (standalone) produce
  different `out/` directories. You cannot deploy both from a single build
  output. Either maintain two Pages projects or use a CI matrix build.
- **No trailing slash**: The app does not use `trailingSlash: true`. If
  `watchyourtemper.com/rlab` is accessed without the trailing slash, the
  Worker redirects (308) to `/rlab/`. This is handled in the Worker code above.
- **Cache invalidation**: Cloudflare may cache the redirect. If you change
  the Worker behavior, purge the cache.
- **Worker chunk paths**: The Web Worker chunk URL is generated by Next.js's
  bundler. Verify in browser DevTools (Network tab) that the worker JS loads
  from `/rlab/_next/static/chunks/...` and not from root.
- **Pages root URL is broken for subpath build**: If you access the Pages
  deployment directly (e.g., `resample-lab-xxxxx.pages.dev/`) after a subpath
  build, the page will render but assets will 404 because the HTML references
  `/rlab/...` paths. This is expected — the Pages URL is only used as a proxy
  target, never directly browsed. The standalone build (Option B) fixes this.
- **No backend proxy**: The Worker above is purely a path-based proxy. It
  does not add API passthrough, cookie forwarding, or any backend logic.
  There is no backend to proxy.
