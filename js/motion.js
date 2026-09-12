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

  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
    initReveals();
  }
}
