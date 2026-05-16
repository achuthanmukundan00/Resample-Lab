# Launch Checklist — Resample-Lab

> Minimal pre-flight checks for the static-site deployment.

---

## 1. Local Test

- [ ] `cd apps/web && pnpm dev` starts without errors
- [ ] Home page loads: upload + preset selection + chaos slider all render
- [ ] `/docs` page loads with full documentation
- [ ] Upload a short WAV file, generate any preset, download ZIP
- [ ] Verify ZIP contains organized WAV files in category folders
- [ ] Upload unsupported format → clear error
- [ ] Upload silence or degenerate audio → graceful handling (sample skipped, not crash)

## 2. Build

- [ ] `pnpm build` succeeds with no TypeScript errors
- [ ] `pnpm start` serves the static export correctly
- [ ] Verify `out/` contains `index.html` and `docs/index.html`

## 3. Deploy

- [ ] Push to GitHub → Cloudflare Pages auto-deploys
- [ ] Deployed URL loads with no console errors
- [ ] Upload + generate works end-to-end on the deployed site
- [ ] `/docs` route loads on the deployed site

## 4. Post-Launch

- [ ] Check browser console for any uncaught errors
- [ ] Verify ZIP downloads are valid (test extract on Mac/Windows)
- [ ] Confirm offline-ish behavior: loaded page still works if you disconnect network
