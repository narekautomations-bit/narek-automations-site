// Ambient "automation log" rain behind the hero: scattered streams of
// monospace log lines drifting slowly upward, each line typing itself in
// character by character. Deliberately unreadable-as-content — it's
// texture that says "something is running", in the same matrix register
// as the wireframe grid behind it.
//
// Four things keep it from resolving into tidy columns, which is what it
// looked like on the first pass: stream x positions are evenly spread but
// jittered, each stream gets its own font scale and drift speed, roughly
// half of every stream's line slots are empty, and each line is nudged
// horizontally so a stream has no straight left edge.
//
// All motion is CSS (drift + type keyframes). This module builds the DOM
// once and hands per-element timing, scale and dimming to CSS as custom
// properties. There is no per-frame JS, so it costs essentially nothing
// running alongside the WebGL grid.

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

// Per-line rhythm in px. Must match the line-height on .matrix-rain__line,
// since it's what decides how many slots a stream needs to cover the
// viewport and how tall the empty-slot spacers are.
const LINE_PITCH = 24;

// Share of line slots left empty. High enough to punch real holes in every
// stream — the holes are most of what reads as chaos.
const GAP_RATE = 0.46;

// Deterministic PRNG (mulberry32): unpredictable-looking, but the layout
// is stable across reloads instead of rearranging itself every visit.
function makeRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function initMatrixRain({ containerId = "matrix-rain" } = {}) {
  const host = document.getElementById(containerId);
  if (!host) return;

  const isCompact = window.innerWidth < 820;
  const streamCount = isCompact ? 6 : 14;
  const slotsPerSet = Math.ceil(window.innerHeight / LINE_PITCH) + 4;
  const rand = makeRandom(0x5eed1a);
  const frag = document.createDocumentFragment();

  for (let c = 0; c < streamCount; c++) {
    // Spread across the width, then jitter — even spacing alone reads as a
    // table, pure randomness leaves bald patches.
    const x = (c / streamCount) * 96 + (rand() * 9 - 4.5);
    const col = document.createElement("div");
    col.className = "matrix-rain__col";
    col.style.setProperty("--col-x", `${x.toFixed(2)}%`);
    col.style.setProperty("--col-scale", (0.66 + rand() * 0.34).toFixed(3));
    col.style.setProperty("--col-depth", (0.45 + rand() * 0.55).toFixed(3));
    col.style.setProperty("--drift-duration", `${(46 + rand() * 46).toFixed(1)}s`);
    // Negative delay: every stream starts part-way through its own loop, so
    // nothing has to "arrive" on page load.
    col.style.setProperty("--drift-delay", `-${(rand() * 40).toFixed(1)}s`);

    const track = document.createElement("div");
    track.className = "matrix-rain__track";

    // Two identical sets stacked. The drift travels exactly one set height
    // (-50% of the track), so the loop point is invisible. Both sets have
    // to come out identical, hence drawing the slot list up front.
    const slots = [];
    for (let i = 0; i < slotsPerSet; i++) {
      if (rand() < GAP_RATE) {
        slots.push(null);
        continue;
      }
      const text = LOG_LINES[Math.floor(rand() * LOG_LINES.length)];
      slots.push({
        text,
        jitter: (rand() * 60 - 26).toFixed(0),
        dim: (0.55 + rand() * 0.45).toFixed(2),
        hot: rand() < 0.12,
        // Spread the typing out so only a few lines are mid-type at any
        // moment — a wall of simultaneously typing text reads as noise.
        delay: (rand() * 11).toFixed(2),
      });
    }

    for (let set = 0; set < 2; set++) {
      let runOfGaps = 0;
      const flushGaps = () => {
        if (!runOfGaps) return;
        // One element per run of empty slots, so the holes cost nothing.
        const gap = document.createElement("span");
        gap.className = "matrix-rain__gap";
        gap.style.setProperty("--gap-h", `${runOfGaps * LINE_PITCH}px`);
        track.appendChild(gap);
        runOfGaps = 0;
      };

      slots.forEach((slot) => {
        if (!slot) {
          runOfGaps++;
          return;
        }
        flushGaps();
        const line = document.createElement("span");
        line.className = slot.hot ? "matrix-rain__line matrix-rain__line--hot" : "matrix-rain__line";
        line.textContent = slot.text;
        line.style.setProperty("--line-x", `${slot.jitter}px`);
        line.style.setProperty("--line-dim", slot.dim);
        line.style.setProperty("--type-delay", `${slot.delay}s`);
        line.style.setProperty("--type-steps", String(Math.max(8, slot.text.length)));
        track.appendChild(line);
      });

      flushGaps();
    }

    col.appendChild(track);
    frag.appendChild(col);
  }

  host.replaceChildren(frag);
  // Gates both the fade-in and the animations, so nothing is mid-flight
  // before the markup exists.
  host.setAttribute("data-ready", "true");
}
