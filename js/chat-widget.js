import { CHAT_BACKEND_URL } from "./config.js";
import { GREETING, SUGGESTIONS, matchFaq } from "./chat-data.js";

async function getAssistantReply(userText) {
  if (!CHAT_BACKEND_URL) {
    // v1: local keyword matching, no network call. See README.md to wire
    // up a real backend later — only this branch needs to change.
    return matchFaq(userText);
  }
  const res = await fetch(CHAT_BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: userText }),
  });
  const data = await res.json();
  return data.reply;
}

export function initChatWidget() {
  const toggle = document.getElementById("chat-toggle");
  const panel = document.getElementById("chat-panel");
  const closeBtn = document.getElementById("chat-close");
  const messages = document.getElementById("chat-messages");
  const suggestionsEl = document.getElementById("chat-suggestions");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  if (!toggle || !panel || !messages || !form || !input) return;

  let greeted = false;

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function addMessage(role, text) {
    const el = document.createElement("div");
    el.className = `chat-msg chat-msg--${role}`;
    el.textContent = text;
    messages.appendChild(el);
    scrollToBottom();
  }

  function renderSuggestions() {
    suggestionsEl.innerHTML = "";
    SUGGESTIONS.forEach((text) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat-suggestion";
      btn.textContent = text;
      btn.addEventListener("click", () => sendMessage(text));
      suggestionsEl.appendChild(btn);
    });
  }

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    addMessage("user", trimmed);
    input.value = "";

    const typingEl = document.createElement("div");
    typingEl.className = "chat-typing";
    typingEl.innerHTML = "<span></span><span></span><span></span>";
    messages.appendChild(typingEl);
    scrollToBottom();

    const reply = await getAssistantReply(trimmed);

    // Small simulated delay so the reply doesn't feel instant/robotic.
    await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 400));

    typingEl.remove();
    addMessage("bot", reply);
  }

  function openPanel() {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    if (!greeted) {
      addMessage("bot", GREETING);
      renderSuggestions();
      greeted = true;
    }
    input.focus();
  }

  function closePanel() {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  }

  toggle.addEventListener("click", () => {
    if (panel.hidden) openPanel();
    else closePanel();
  });

  closeBtn?.addEventListener("click", closePanel);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) closePanel();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    sendMessage(input.value);
  });
}
