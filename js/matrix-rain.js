// Ambient "automation log" rain behind the hero: columns of faint monospace
// log lines drifting slowly upward, each line typing itself in character by
// character. Deliberately unreadable-as-content — it's texture that says
// "something is running", sitting in the same matrix register as the
// wireframe grid already behind it.
//
// All motion is CSS (drift + type keyframes). This module builds the DOM
// once and hands per-element timing/depth to CSS as custom properties.
// There is no per-frame JS, so it costs essentially nothing running
// alongside the WebGL grid.
//
// Legibility is handled by keeping the whole layer very faint (see
// --rain-alpha in components.css) plus the text halos already applied to
// dark-section headings, NOT by trying to dodge the headline — a column
// that dodges text has to know where the text is at every breakpoint, and
// gets it wrong the moment the copy changes.

const LOG_LINES = [
  "$ reconcile --ledger cash",
  "[ok] 1,284 rows matched",
  "> flagging 6 exceptions...",
  "$ build workpapers --month-end",
  "[ok] engagement letters generated",
  "> exporting PDF · 84 files",
  "$ close run --period current",
  "[ok] trial balance ties",
  "> indexing client files...",
  "$ merge template --engagement",
  "[ok] 312 invoices aged",
  "> variance check · 0.00 delta",
  "$ import bank-export.csv",
  "[ok] duplicates removed",
  "> renaming output · client-ready",
  "$ validate --against prior",
  "[ok] no unmatched entries",
  "> writing summary tab...",
  "$ run recon --tolerance 0.01",
  "[ok] statements reconciled",
  "> queueing follow-up list",
  "$ generate tracker --AR",
  "[ok] formulas rebuilt",
  "> checkpoint saved",
  "$ extract fields --pdf",
  "[ok] 1,040 cells populated",
  "> sanitizing sample data...",
  "$ diff vs last-month.xlsx",
  "[ok] handoff package ready",
  "> done in 4.2s",
];

// Per-line rhythm in px. Must match the line-height set on
// .matrix-rain__line, since it's how many lines a column needs to cover
// the viewport is derived from it.
const LINE_PITCH = 21;

// Hand-placed columns rather than even spacing — even spacing reads as a
// table, uneven reads as ambient. `depth` scales the column's opacity so
// some sit further back than others.
const COLUMNS_WIDE = [
  { x: 1, depth: 1 },
  { x: 22, depth: 0.55 },
  { x: 47, depth: 0.75 },
  { x: 71, depth: 0.6 },
  { x: 88, depth: 0.95 },
];
const COLUMNS_COMPACT = [
  { x: 2, depth: 0.85 },
  { x: 55, depth: 0.6 },
];

function shuffled(source, seedOffset) {
  // Deterministic shuffle: unrelated-looking column to column, but stable
  // across reloads instead of rearranging itself on every visit.
  const out = source.slice();
  let seed = 9301 + seedOffset * 137;
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280;
    const j = Math.floor((seed / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function initMatrixRain({ containerId = "matrix-rain" } = {}) {
  const host = document.getElementById(containerId);
  if (!host) return;

  const columns = window.innerWidth < 820 ? COLUMNS_COMPACT : COLUMNS_WIDE;
  const linesPerSet = Math.ceil(window.innerHeight / LINE_PITCH) + 4;
  const frag = document.createDocumentFragment();

  columns.forEach((spec, c) => {
    const col = document.createElement("div");
    col.className = "matrix-rain__col";
    col.style.setProperty("--col-x", `${spec.x}%`);
    col.style.setProperty("--col-depth", String(spec.depth));
    // Slightly different periods per column so they never march in step.
    col.style.setProperty("--drift-duration", `${52 + c * 11}s`);
    // Negative delay: each column starts already part-way through its
    // loop, so nothing has to "arrive" on page load.
    col.style.setProperty("--drift-delay", `${c * -9}s`);

    const track = document.createElement("div");
    track.className = "matrix-rain__track";

    const pool = shuffled(LOG_LINES, c);

    // Two identical sets stacked. The drift travels exactly one set height
    // (-50% of the track), so the loop point is invisible.
    for (let set = 0; set < 2; set++) {
      for (let i = 0; i < linesPerSet; i++) {
        const text = pool[i % pool.length];
        const line = document.createElement("span");
        line.className = "matrix-rain__line";
        line.textContent = text;
        // Spread the typing out so only a few lines are mid-type at any
        // moment — a wall of simultaneously typing text reads as noise.
        line.style.setProperty("--type-delay", `${((i * 1.37 + c * 0.8) % 11).toFixed(2)}s`);
        line.style.setProperty("--type-steps", String(Math.max(8, text.length)));
        track.appendChild(line);
      }
    }

    col.appendChild(track);
    frag.appendChild(col);
  });

  host.replaceChildren(frag);
  // Gates both the fade-in and the animations, so nothing is mid-flight
  // before the markup exists.
  host.setAttribute("data-ready", "true");
}
