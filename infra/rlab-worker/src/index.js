// watchyourtemper.com/rlab proxy — forwards to Resample-Lab Cloudflare Pages origin.
//
// The Next.js static export is built with NEXT_PUBLIC_BASE_PATH=/rlab, so all
// asset references in the HTML point to /rlab/_next/static/... and
// /rlab/wyt-logo.png.  This Worker strips the /rlab prefix before forwarding
// to the Pages origin, which serves those files at root level.

const FRONTEND_ORIGIN = "https://resample-lab.pages.dev";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Redirect /rlab → /rlab/ so relative asset paths resolve correctly.
    if (url.pathname === "/rlab") {
      url.pathname = "/rlab/";
      return Response.redirect(url.toString(), 308);
    }

    // Handle /rlab/... requests — proxy to the Pages origin.
    if (url.pathname.startsWith("/rlab/")) {
      const target = new URL(request.url);
      target.protocol = "https";
      target.hostname = new URL(FRONTEND_ORIGIN).hostname;

      // Strip the /rlab prefix:
      //   Public:  /rlab/_next/static/...
      //   Origin:  /_next/static/...
      target.pathname = target.pathname.replace(/^\/rlab/, "") || "/";

      return fetch(new Request(target.toString(), request));
    }

    // Let all other requests pass through unmodified.
    return fetch(request);
  },
};
