export function initKineticText() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || typeof gsap === "undefined" || typeof SplitText === "undefined") return;

  const target = document.querySelector("#top [data-kinetic]");
  if (!target) return;

  gsap.registerPlugin(SplitText);

  // The h1 itself carries the .reveal class (permanent opacity:0 in
  // animations.css — see the note in motion.js). motion.js's hero batch
  // deliberately excludes [data-kinetic], so nothing else ever lifts this
  // container back to visible; this module owns that responsibility now.
  gsap.set(target, { opacity: 1, y: 0 });

  const split = new SplitText(target, { type: "words", wordsClass: "kinetic-word" });

  gsap.set(split.words, { display: "inline-block" });

  gsap.from(split.words, {
    opacity: 0,
    y: "0.6em",
    rotateX: -35,
    transformOrigin: "50% 100%",
    duration: 0.7,
    ease: "expo.out",
    stagger: 0.04,
    delay: 0.1,
  });
}
