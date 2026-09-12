// The FAQ as a terminal: questions on the left read as prompts, and
// picking one types its answer into the console panel on the right.
// Replaces the old accordion — it answers the same questions, but it's
// the part of the page where a visitor pokes at something and finds out
// the site responds.
//
// Built on the standard vertical tablist pattern (roving tabindex, arrow
// keys, Home/End), so it behaves like a real widget rather than a pile of
// click handlers.
//
// Accessibility note on the typing: each answer ships in the HTML as real
// text, which is what search engines and screen readers get. On init that
// original node becomes the screen-reader copy (visually hidden, holding
// the complete answer) and a second aria-hidden node is created to be
// typed into. So assistive tech always has the whole answer immediately,
// and only the decorative copy animates.

const TICK_MS = 12;
// Long answers type faster per tick so every answer finishes in roughly
// the same time — a constant per-character speed makes the long ones drag.
const TARGET_TICKS = 150;

export function initFaqConsole({ containerId = "faq-console" } = {}) {
  const root = document.getElementById(containerId);
  if (!root) return;

  const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
  const panels = Array.from(root.querySelectorAll('[role="tabpanel"]'));
  if (!tabs.length || tabs.length !== panels.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let typingTimer = null;

  // Split each answer into the screen-reader copy and the typed copy.
  const typedNodes = panels.map((panel) => {
    const source = panel.querySelector(".faq-console__answer");
    if (!source) return null;
    const full = source.textContent.trim();

    source.classList.add("visually-hidden");
    const typed = document.createElement("p");
    typed.className = "faq-console__answer faq-console__answer--typed";
    typed.setAttribute("aria-hidden", "true");
    typed.dataset.full = full;
    source.after(typed);
    return typed;
  });

  function type(node) {
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = null;
    }
    if (!node) return;

    const full = node.dataset.full || "";
    if (reduceMotion) {
      node.textContent = full;
      return;
    }

    const step = Math.max(1, Math.ceil(full.length / TARGET_TICKS));
    let i = 0;
    node.textContent = "";
    node.classList.add("is-typing");
    typingTimer = setInterval(() => {
      i += step;
      node.textContent = full.slice(0, i);
      if (i >= full.length) {
        clearInterval(typingTimer);
        typingTimer = null;
        node.classList.remove("is-typing");
      }
    }, TICK_MS);
  }

  function select(index, { focusTab = false } = {}) {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[i].hidden = !active;
    });
    if (focusTab) tabs[index].focus();
    type(typedNodes[index]);

    // On the stacked layout the console sits below the whole question
    // list, so a tap near the bottom of the list would otherwise type the
    // answer off-screen.
    const screen = root.querySelector(".faq-console__screen");
    if (screen && screen.getBoundingClientRect().top > window.innerHeight - 80) {
      screen.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(i));
    tab.addEventListener("keydown", (e) => {
      const last = tabs.length - 1;
      let next = null;
      if (e.key === "ArrowDown" || e.key === "ArrowRight") next = i === last ? 0 : i + 1;
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = i === 0 ? last : i - 1;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = last;
      if (next === null) return;
      e.preventDefault();
      select(next, { focusTab: true });
    });
  });

  // Type the first answer only once the console is actually on screen,
  // otherwise the one bit of the page that's meant to feel responsive has
  // already finished before anyone sees it.
  if (!("IntersectionObserver" in window)) {
    select(0);
    return;
  }

  tabs.forEach((tab, i) => {
    tab.setAttribute("aria-selected", String(i === 0));
    tab.tabIndex = i === 0 ? 0 : -1;
    panels[i].hidden = i !== 0;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        type(typedNodes[0]);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.3 }
  );
  observer.observe(root);
}
