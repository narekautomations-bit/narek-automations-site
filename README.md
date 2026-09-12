# Narek Automations — site

Plain static HTML/CSS/JS, no build step, no framework. Open `index.html` via a
local server (not `file://` — see below) to preview.

**Live site:** https://narekautomations.com
Deploys automatically on every push to `master` (Netlify is connected to
this GitHub repo via the Netlify GitHub App). Domain purchased and managed
through Netlify's registrar — DNS and SSL are auto-configured, renews
annually (~$17/yr).

## Local preview

Browsers block ES module imports (`<script type="module">`) from a bare
`file://` page, so open the site through a tiny local server instead:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Contact info

Lives in [`js/config.js`](js/config.js) as `CONTACT_EMAIL` / `CONTACT_PHONE`,
used across the nav CTA, contact section, and footer. Update there if either
changes.

## Netlify setup (already configured)

- **Forms**: the contact form has `data-netlify="true"` — Netlify Forms picks
  it up automatically on deploy. Submissions appear in
  **Forms** in the Netlify dashboard, and also get emailed to
  `narekautomations@gmail.com` automatically (configured via a Netlify
  notification hook).
- **Continuous deployment**: connected to
  `narekautomations-bit/narek-automations-site` on `master`. No build command
  needed — publish directory is the project root.

## Adding a real backend later (optional)

The seam lives in `js/config.js` as `null` — flipping it on is the only code
change required, no rewrite:

- **Contact form** (`FORM_BACKEND_URL`): only needed if you move off Netlify
  Forms — e.g. to a CRM. Netlify Forms works out of the box otherwise.

## File map

- `index.html` — all page content/copy
- `css/tokens.css` — colors, type, spacing, motion (the design system)
- `css/base.css`, `layout.css`, `components.css`, `animations.css`
- `js/config.js` — contact info + backend seam (start here)
- `js/main.js` — wires up every module on page load
- `js/smooth-scroll.js` — native smooth-scroll anchor navigation
- `js/motion.js` — GSAP scroll reveals and parallax
- `js/kinetic-text.js` — hero headline word-cascade (SplitText)
- `js/magnetic.js` — magnetic pull on primary buttons
- `js/interactive-grid.js` — page-wide cursor/touch-reactive WebGL grid
- `js/matrix-rain.js`, `matrix-fall.js` — build the hero's two matrix layers
  (horizontal log rain and vertical fall); CSS does all the animating
- `js/process-diagram.js` — scroll trigger for the run-flow diagram
- `js/faq-console.js` — the FAQ terminal (tablist + answer typing)
- `js/nav-menu.js` — the nav's dropdown
- `js/contact-form.js` — client-side validation and submission
