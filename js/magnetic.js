// Subtle magnetic pull on [data-magnetic] elements (nav CTA, hero buttons,
// logo) — buttons nudge slightly toward the cursor on hover. No custom
// cursor involved; the native pointer is left alone.
export function initMagneticButtons() {
  const isFinePointer = window.matchMedia("(pointer: fine)").matches;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!isFinePointer || reduceMotion || typeof gsap === "undefined") return;

  document.querySelectorAll("[data-magnetic]").forEach((el) => {
    const strength = parseFloat(el.getAttribute("data-magnetic-strength")) || 0.25;
    const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });

    el.addEventListener("mousemove", (e) => {
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - rect.left - rect.width / 2;
      const relY = e.clientY - rect.top - rect.height / 2;
      xTo(relX * strength);
      yTo(relY * strength);
    });

    el.addEventListener("mouseleave", () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
    });
  });
}
