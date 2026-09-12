import { CONTACT_EMAIL, CONTACT_PHONE, CONTACT_PHONE_E164 } from "./config.js";
import { initSmoothScroll } from "./smooth-scroll.js";
import { initMotion } from "./motion.js";
import { initKineticText } from "./kinetic-text.js";
import { initMagneticButtons } from "./magnetic.js";
import { initPageGrid } from "./interactive-grid.js";
import { initMatrixRain } from "./matrix-rain.js";
import { initProcessDiagram } from "./process-diagram.js";
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
    phoneLink.href = `tel:${CONTACT_PHONE_E164}`;
    phoneText.textContent = CONTACT_PHONE;
  }

  // The sms: hrefs are only wired up here, so the markup can ship an
  // in-page fallback (#contact) for anyone without JS — a dead sms: link
  // on a desktop browser is worse than a link to the contact form.
  document.querySelectorAll("[data-sms-link], #hero-sms-link, #contact-sms-link").forEach((el) => {
    el.href = `sms:${CONTACT_PHONE_E164}`;
  });
  const smsText = document.getElementById("contact-sms-text");
  if (smsText) smsText.textContent = CONTACT_PHONE;
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
  initPageGrid();
  initMatrixRain();
  initProcessDiagram();
  initChatWidget();
  initContactForm();
  initFaqAccordion();
});
