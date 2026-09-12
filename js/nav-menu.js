// The nav's single dropdown, replacing the old inline link list. Keeping
// the links behind one deliberate click is the point — the page wants you
// scrolling, not menu-hopping (see .scroll-cue).
//
// Standard disclosure-menu behaviour: click to toggle, Escape closes and
// returns focus to the button, a click anywhere outside closes, and
// picking a link closes it on the way to the anchor.

export function initNavMenu({ containerId = "nav-menu" } = {}) {
  const root = document.getElementById(containerId);
  if (!root) return;

  const toggle = root.querySelector(".nav-menu__toggle");
  const list = root.querySelector(".nav-menu__list");
  if (!toggle || !list) return;

  let open = false;

  function setOpen(next, { restoreFocus = false } = {}) {
    open = next;
    toggle.setAttribute("aria-expanded", String(open));
    list.hidden = !open;
    root.classList.toggle("is-open", open);
    if (!open && restoreFocus) toggle.focus();
  }

  toggle.addEventListener("click", () => setOpen(!open));

  // Anchor navigation is handled by smooth-scroll.js; this just gets the
  // menu out of the way first.
  list.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && open) setOpen(false, { restoreFocus: true });
  });

  document.addEventListener("click", (e) => {
    if (open && !root.contains(e.target)) setOpen(false);
  });

  // Tabbing out of the menu should close it too, otherwise it hangs open
  // behind the rest of the page.
  root.addEventListener("focusout", (e) => {
    if (open && !root.contains(e.relatedTarget)) setOpen(false);
  });

  setOpen(false);
}
