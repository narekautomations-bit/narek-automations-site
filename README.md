# Narek Automations — site

Plain static HTML/CSS/JS, no build step, no framework. Open `index.html` via a
local server (not `file://` — see below) to preview.

## Before launch: swap the placeholders

Everything below lives in [`js/config.js`](js/config.js):

- `CONTACT_EMAIL` / `CONTACT_PHONE` — currently placeholders, used across the
  nav CTA, contact section, and footer.

## Local preview

Browsers block ES module imports (`<script type="module">`) from a bare
`file://` page, so open the site through a tiny local server instead:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Deploying (Netlify)

1. Push this folder to a GitHub repo, or drag-and-drop the folder into
   Netlify's dashboard for an instant deploy.
2. No build command needed — publish directory is the project root.
3. The contact form already has `data-netlify="true"` — Netlify Forms picks
   it up automatically on deploy. Submissions show up in
   **Site settings → Forms** in the Netlify dashboard. Turn on email
   notifications there if you want each submission emailed to you directly.

## Adding a real backend later (optional)

Both seams live in `js/config.js` as `null` — flipping either on is the only
code change required, no rewrite:

- **Chat widget** (`CHAT_BACKEND_URL`): add a Netlify Function (e.g.
  `netlify/functions/chat.js`) that proxies to an LLM API, store the API key
  as a Netlify environment variable (never commit it), then set
  `CHAT_BACKEND_URL = "/.netlify/functions/chat"`. `js/chat-widget.js`
  already calls this URL with `{ message }` and expects `{ reply }` back.
- **Contact form** (`FORM_BACKEND_URL`): only needed if you move off Netlify
  Forms — e.g. to a CRM. Netlify Forms works out of the box otherwise.

## File map

- `index.html` — all page content/copy
- `css/tokens.css` — colors, type, spacing, motion (the design system)
- `css/base.css`, `layout.css`, `components.css`, `animations.css`
- `js/config.js` — contact info + backend seams (start here)
- `js/main.js` — wires up every module on page load
- `js/motion.js` — GSAP scroll reveals + hero formula-bar typewriter
- `js/roi-calculator.js`, `before-after-demo.js`, `chat-widget.js`,
  `chat-data.js`, `contact-form.js`, `faq-accordion.js` — the interactive
  features, one file each

<!-- deploy test -->
