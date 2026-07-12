# Prime Reserve Planning — static site

A self-contained static rebuild of [primereserveplanning.com](https://www.primereserveplanning.com/)
(13 core pages), redesigned with the [Hallmark](https://github.com/nutlope/hallmark)
design skill and packaged for Cloudflare Pages. No build step, no framework —
plain HTML, CSS, and a few lines of JS.

## Deploy to Cloudflare Pages

**Option A — drag and drop (fastest):**
1. Go to [Cloudflare dashboard](https://dash.cloudflare.com/) → Workers & Pages → Create → Pages → *Upload assets*.
2. Drag this `prime-reserve` folder into the upload area.
3. Done — you get a `*.pages.dev` URL immediately. Attach your custom domain under the project's *Custom domains* tab when ready.

**Option B — connect to Git:**
1. Workers & Pages → Create → Pages → *Connect to Git* and pick this repository.
2. Build settings: framework preset **None**, build command **(leave empty)**, build output directory **`prime-reserve`**.
3. Every push redeploys automatically.

## What's inside

| Path | What it is |
| --- | --- |
| `*.html` | The 13 pages, slugs matching the live site (plus `404.html`) |
| `css/tokens.css` | The design tokens (colour, type, spacing, motion) |
| `css/site.css` | All page styling — token-driven, no inline values |
| `js/site.js` | Nav frost-on-scroll, mobile menu, mailto form composer |
| `design.md` | The locked Hallmark design system for the site |
| `_redirects` | Routes `/blog` to the live site until migrated |
| `.hallmark/log.json` | Hallmark project memory (design provenance) |

## Known gaps / next steps

- **Forms have no backend.** Submitting opens a pre-filled email to
  `contact@primereserveplanning.com` (and each form says so). To capture
  submissions properly, wire the forms to a Cloudflare Pages Function,
  Formspree, or similar, and remove the `data-mailto` attribute.
- **Sample report PDFs** still link to the live site's samples page. Drop the
  PDFs into this folder and update the four links in `samples.html`.
- **Leadership headshots** are not included (the rebuild is typography-first).
  Add real photos to the `person__card` blocks if wanted.
- **Blog and per-state SEO pages** were not duplicated — the live site has
  hundreds of programmatically generated location pages. `_redirects` sends
  `/blog` traffic to the live site. If you cut the domain over, decide whether
  to migrate, regenerate, or retire those URLs first.
- **Fonts** load from Google Fonts (Source Serif 4, Geist, Geist Mono). To
  self-host, download the woff2 files and swap the `<link>` tags for
  `@font-face` rules in `tokens.css`.
