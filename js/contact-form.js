import { CONTACT_EMAIL } from "./config.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function encodeForm(formEl) {
  const data = new FormData(formEl);
  return new URLSearchParams(data).toString();
}

function setInvalid(fieldEl, invalid) {
  fieldEl.setAttribute("data-invalid", invalid ? "true" : "false");
}

export function initContactForm() {
  const form = document.getElementById("contact-form");
  const statusEl = document.getElementById("form-status");
  if (!form || !statusEl) return;

  function showStatus(kind, message) {
    statusEl.textContent = message;
    statusEl.className = `form-status form-status--${kind}`;
    statusEl.setAttribute("data-visible", "true");
  }

  function validate() {
    let valid = true;

    const nameField = form.querySelector('[data-field="name"]');
    const nameInput = nameField.querySelector("input");
    const nameOk = nameInput.value.trim().length > 0;
    setInvalid(nameField, !nameOk);
    valid = valid && nameOk;

    const emailField = form.querySelector('[data-field="email"]');
    const emailInput = emailField.querySelector("input");
    const emailOk = EMAIL_RE.test(emailInput.value.trim());
    setInvalid(emailField, !emailOk);
    valid = valid && emailOk;

    const messageField = form.querySelector('[data-field="message"]');
    const messageInput = messageField.querySelector("textarea");
    const messageOk = messageInput.value.trim().length > 0;
    setInvalid(messageField, !messageOk);
    valid = valid && messageOk;

    return valid;
  }

  form.querySelectorAll("input, textarea").forEach((el) => {
    el.addEventListener("blur", () => {
      const field = el.closest(".form-field");
      if (field && field.getAttribute("data-invalid") === "true") validate();
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    statusEl.setAttribute("data-visible", "false");

    if (!validate()) {
      showStatus("error", "Please fix the highlighted fields and try again.");
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const originalLabel = submitBtn.textContent;
    submitBtn.textContent = "Sending…";

    try {
      // Post to an absolute https:// URL, not a relative path. If a visitor
      // ever lands on a plain http:// URL, a relative-path fetch would
      // submit over http and get caught in Netlify's http->https redirect
      // mid-request, which browsers treat as a cross-origin hop — the
      // fetch throws (even though Netlify still records the submission),
      // showing a false "something went wrong" error.
      const submitUrl = `https://${window.location.host}${window.location.pathname}`;
      const response = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encodeForm(form),
      });

      if (!response.ok) throw new Error(`Form submission failed (${response.status})`);

      showStatus("success", "Thanks — your message is on its way. I'll follow up within one business day.");
      form.reset();
    } catch (err) {
      showStatus(
        "error",
        `Something went wrong sending this automatically. Please email ${CONTACT_EMAIL} directly and I'll get back to you.`
      );
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}
