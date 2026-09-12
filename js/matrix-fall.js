// The vertical half of the hero's matrix layer: columns of single
// characters falling downward, each with a bright head and a tail that
// fades out behind it. Runs alongside the horizontal log rain
// (js/matrix-rain.js) — one drifts up, one falls down, and the two
// crossing is what sells the effect.
//
// Column starts are staggered by a positive delay rather than a negative
// one, so on load the columns arrive a few at a time instead of the whole
// wall dropping at once.
//
// Same contract as the log rain: this builds the DOM once and hands all
// timing to CSS custom properties. No per-frame JS.

// Excel-flavoured rather than katakana: column letters, digits, and the
// punctuation you actually see in a formula bar. Reads as "spreadsheet
// under load", which is the point.
const GLYPHS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$%=+-*/<>()[]{}.,:;|!";

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

export function initMatrixFall({ containerId = "matrix-fall" } = {}) {
  const host = document.getElementById(containerId);
  if (!host) return;

  const isCompact = window.innerWidth < 820;
  const columnCount = isCompact ? 9 : 21;
  const rand = makeRandom(0xfa11);
  const frag = document.createDocumentFragment();

  for (let c = 0; c < columnCount; c++) {
    // Spread then jitter, same as the log rain: even spacing alone reads as
    // a table, pure randomness leaves bald patches.
    const x = (c / columnCount) * 97 + (rand() * 7 - 3.5);
    const trailLength = 9 + Math.floor(rand() * 18);

    const col = document.createElement("div");
    col.className = "matrix-fall__col";
    col.style.setProperty("--col-x", `${x.toFixed(2)}%`);
    col.style.setProperty("--col-scale", (0.7 + rand() * 0.5).toFixed(3));
    col.style.setProperty("--col-depth", (0.4 + rand() * 0.6).toFixed(3));
    col.style.setProperty("--fall-duration", `${(7 + rand() * 11).toFixed(1)}s`);
    col.style.setProperty("--fall-delay", `${(rand() * 13).toFixed(1)}s`);

    const trail = document.createElement("div");
    trail.className = "matrix-fall__trail";

    for (let i = 0; i < trailLength; i++) {
      const isHead = i === trailLength - 1;
      const ch = document.createElement("span");
      // Ramp the tail from nearly invisible at the top to full at the head,
      // eased so the brightness piles up near the leading character.
      const t = (i + 1) / trailLength;
      ch.style.setProperty("--char-dim", (t * t * t).toFixed(3));
      ch.textContent = GLYPHS[Math.floor(rand() * GLYPHS.length)];
      if (isHead) {
        ch.className = "matrix-fall__head";
      } else if (rand() < 0.22) {
        // A few characters per trail flicker. CSS can't swap the glyph, but
        // blinking one is enough to imply the character is changing.
        ch.className = "matrix-fall__flicker";
        ch.style.setProperty("--flicker-duration", `${(0.5 + rand() * 1.4).toFixed(2)}s`);
      }
      trail.appendChild(ch);
    }

    col.appendChild(trail);
    frag.appendChild(col);
  }

  host.replaceChildren(frag);
  host.setAttribute("data-ready", "true");
}
