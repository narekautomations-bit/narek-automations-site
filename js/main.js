import { CONTACT_EMAIL, CONTACT_PHONE } from "./config.js";
import { initSmoothScroll } from "./smooth-scroll.js";
import { initMotion } from "./motion.js";
import { initKineticText } from "./kinetic-text.js";
import { initMagneticButtons } from "./magnetic.js";
import { initInteractiveGrid } from "./interactive-grid.js";
import { initChatWidget } from "./chat-widget.js";
import { initContactForm } from "./contact-form.js";
import { initFaqAccordion } from "./faq-accordion.js";

function injectContactInfo() {
  const emailLink = document.getElementById("contact-email-link");
  const emailText = document.getElementById("contact-email-text");
  const phoneLink = document.getElementById("contact-phone-link");
  const phoneText = document.getElementById("contact-phone-text");

  if (emailLink && emailText) {
    emailLink.href = `mailto:${CONTACT_EMAIL}`;
    emailText.textContent = CONTACT_EMAIL;
  }
  if (phoneLink && phoneText) {
    const digits = CONTACT_PHONE.replace(/[^\d+]/g, "");
    phoneLink.href = `tel:${digits}`;
    phoneText.textContent = CONTACT_PHONE;
  }
}

function injectFooterYear() {
  const el = document.getElementById("footer-year");
  if (el) el.textContent = String(new Date().getFullYear());
}

document.addEventListener("DOMContentLoaded", () => {
  injectContactInfo();
  injectFooterYear();
  initSmoothScroll();
  initMotion();
  initKineticText();
  initMagneticButtons();
  initInteractiveGrid({ canvasId: "hero-webgl", gridFallbackId: "hero-bg-grid", sectionSelector: "#top" });
  initInteractiveGrid({
    canvasId: "process-webgl",
    gridFallbackId: "process-bg-grid",
    sectionSelector: "#how-it-works",
  });
  initChatWidget();
  initContactForm();
  initFaqAccordion();
});
