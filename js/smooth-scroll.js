// In-page anchor navigation via native smooth scrolling. An earlier version
// of this used Lenis for both wheel-smoothing and anchor jumps, but Lenis's
// scrollTo() (and, it turned out, its wheel-smoothing too) had a consistent
// ~400-500ms dead pause before any visible movement — reproduced even with
// a bare default Lenis instance, so it's a library characteristic, not a
// config issue. Native scrolling has no such delay and modern
// trackpads/mice are already smooth at the OS level, so there's nothing
// left for a smoothing library to usefully add here.
export function initSmoothScroll() {
  const nav = document.querySelector(".nav");

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();

      const offset = id === "#top" ? 0 : -(nav?.offsetHeight ?? 0) - 12;
      const top = target.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top, behavior: "smooth" });
    });
  });
}
