const FORMULAS = [
  '=AUTOMATE(A2:A500, "reconcile_statements")',
  '=GENERATE_PDF(Invoices, "engagement_letters")',
  '=CONSOLIDATE(Jan:Dec, "month_end_close")',
  '=FLAG_EXCEPTIONS(Ledger, tolerance=0.01)',
];

function initTypewriter() {
  const el = document.getElementById("formula-typewriter");
  if (!el) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    el.textContent = FORMULAS[0];
    return;
  }

  let formulaIndex = 0;
  let charIndex = 0;
  let deleting = false;

  el.setAttribute("data-typing", "true");
  const cursor = document.createElement("span");
  cursor.className = "formula-bar__cursor";
  el.after(cursor);

  function tick() {
    const current = FORMULAS[formulaIndex];

    if (!deleting) {
      charIndex++;
      el.textContent = current.slice(0, charIndex);
      if (charIndex === current.length) {
        deleting = true;
        setTimeout(tick, 1800);
        return;
      }
      setTimeout(tick, 38);
    } else {
      charIndex--;
      el.textContent = current.slice(0, charIndex);
      if (charIndex === 0) {
        deleting = false;
        formulaIndex = (formulaIndex + 1) % FORMULAS.length;
        setTimeout(tick, 400);
        return;
      }
      setTimeout(tick, 18);
    }
  }

  tick();
}

function initReveals() {
  gsap.registerPlugin(ScrollTrigger);

  gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
    // Note: .fromTo() (not .from()) is deliberate — the .reveal class in
    // animations.css sets opacity:0 permanently as a no-JS/pre-paint
    // fallback state. gsap.from() infers its "to" value from the element's
    // current computed style, which would resolve to that same opacity:0
    // and produce a 0-to-0 no-op. Explicit fromTo() end values sidestep that.

    // Hero: animate immediately on load, in sequence. The h1 is excluded —
    // kinetic-text.js owns it with its own word-cascade SplitText animation.
    const heroEls = gsap.utils.toArray("#top .reveal:not([data-kinetic])");
    gsap.fromTo(
      heroEls,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.7, ease: "power2.out", stagger: 0.1, delay: 0.15 }
    );

    // Every other section: scroll-triggered fade/rise, staggered per section.
    const sections = gsap.utils.toArray("main > section:not(#top)");
    sections.forEach((section) => {
      const els = section.querySelectorAll(".reveal");
      if (!els.length) return;
      gsap.fromTo(
        els,
        { opacity: 0, y: 28, scale: 0.97 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          ease: "power2.out",
          stagger: 0.08,
          scrollTrigger: {
            trigger: section,
            start: "top 82%",
            toggleActions: "play none none reverse",
          },
        }
      );
    });

    // Subtle parallax depth on the hero's decorative background grid only —
    // kept to one layer so it never competes with the hero entrance tween
    // running on the actual content elements above.
    gsap.to("#hero-bg-grid", {
      yPercent: 18,
      ease: "none",
      scrollTrigger: {
        trigger: "#top",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });
  });
}

export function initMotion() {
  document.body.classList.remove("no-js");
  document.body.classList.add("js-ready");
  initTypewriter();

  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
    initReveals();
  }
}
