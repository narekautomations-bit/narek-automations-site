// Scroll-triggered reveal for the "what one run looks like" flow diagram.
//
// The diagram itself is static HTML + inline SVG (see #run-flow in
// index.html) so it's real text for search engines and screen readers, and
// it renders fine with no JS at all. All this module does is add one class
// when the diagram scrolls into view; CSS owns every transition, the
// connector line-draw, and the idle animations.
//
// Deliberately CSS-transition driven rather than GSAP: the reveal classes
// GSAP drives on this site (.reveal) set opacity in a permanent stylesheet
// rule, which makes gsap.from() infer the wrong end value and animate
// 0 -> 0. Keeping this self-contained avoids re-entering that trap.

export function initProcessDiagram({ containerId = "run-flow" } = {}) {
  const flow = document.getElementById(containerId);
  if (!flow) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // No IntersectionObserver (or no motion wanted): show the finished state
  // immediately. `is-visible` is the resting state, not the animated one —
  // the only thing that animates is arriving at it.
  if (reduceMotion || !("IntersectionObserver" in window)) {
    flow.classList.add("is-visible");
    return;
  }

  // Marks the pre-animation (hidden) state as safe to apply. CSS only hides
  // the nodes while this is present, so a JS failure leaves the diagram
  // fully visible rather than blank.
  flow.setAttribute("data-flow-ready", "true");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        // One-shot: replaying on every pass would fight the idle animation.
        observer.unobserve(entry.target);
      });
    },
    // Fire once the diagram is meaningfully on screen, not at the first
    // pixel — otherwise the stagger has already finished by the time it's
    // in a comfortable reading position.
    { threshold: 0.25, rootMargin: "0px 0px -8% 0px" }
  );

  observer.observe(flow);
}
