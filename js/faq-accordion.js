export function initFaqAccordion() {
  const items = document.querySelectorAll(".faq__item");
  items.forEach((item) => {
    const button = item.querySelector(".faq__question");
    const answer = item.querySelector(".faq__answer");
    const inner = item.querySelector(".faq__answer-inner");
    if (!button || !answer || !inner) return;

    button.addEventListener("click", () => {
      const isOpen = item.getAttribute("data-open") === "true";
      const next = !isOpen;

      item.setAttribute("data-open", String(next));
      button.setAttribute("aria-expanded", String(next));
      answer.style.height = next ? `${inner.offsetHeight}px` : "0px";
    });
  });
}
