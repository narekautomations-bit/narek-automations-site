// Local FAQ dataset used by chat-widget.js when CHAT_BACKEND_URL is null
// (see config.js). Each entry is matched against the visitor's message by
// simple keyword scoring — no network call, no AI model involved in v1.

export const GREETING =
  "Hi! I'm a scripted assistant, not a live person — I can answer common questions about how this works. For anything specific to your business, use the contact form below and Narek will follow up.";

export const SUGGESTIONS = [
  "How much does this cost?",
  "How long does a project take?",
  "Is my data safe?",
  "How do I get started?",
];

export const FAQ_ENTRIES = [
  {
    keywords: ["cost", "price", "pricing", "much", "budget", "quote", "expensive", "fee"],
    answer:
      "Every project gets a fixed, written quote after a free consultation — it depends on scope, so there's no generic number to share here. Book a call and you'll get a clear quote before any work starts.",
  },
  {
    keywords: ["long", "time", "timeline", "when", "fast", "quick", "deliver", "delivery", "weeks", "days"],
    answer:
      "Most single-workflow projects (a close workbook, a reconciliation tool, a mail-merge script) are delivered in 1-3 weeks after the proposal is approved. Larger or multi-system projects take longer — we'd scope that on the call.",
  },
  {
    keywords: ["safe", "security", "secure", "confidential", "nda", "data", "access", "private", "privacy"],
    answer:
      "Confidentiality is the default: a confidentiality agreement can be signed before any files are shared, most work is done against sanitized sample or historical files, and nothing is stored or reused beyond your project.",
  },
  {
    keywords: ["start", "begin", "started", "process", "step", "works", "how it works"],
    answer:
      "It starts with a free discovery call to understand your current process, then a written scoped proposal, then the build with review checkpoints, then handoff and training. Use the contact form to get that first call scheduled.",
  },
  {
    keywords: ["tool", "tools", "excel", "vba", "python", "word", "pdf", "software", "platform", "tech", "stack"],
    answer:
      "Mostly Excel (formulas, VBA, Office Scripts), Word, and PDF generation — often combined with Python or AI-assisted scripting when it's the better fit. No new software for your team to learn unless you want one.",
  },
  {
    keywords: ["support", "after", "maintain", "maintenance", "break", "fix", "ongoing"],
    answer:
      "Every project includes a short training walkthrough and a post-delivery support window. Ongoing support or future enhancements can be arranged after that if you want them.",
  },
  {
    keywords: ["location", "remote", "los angeles", "la", "area", "where", "based", "in person"],
    answer:
      "Based in Los Angeles, CA, and happy to meet locally — most of the actual build work happens remotely, which keeps things efficient for both of us.",
  },
  {
    keywords: ["cpa", "accounting", "accountant", "firm", "bookkeeping", "audit"],
    answer:
      "CPA and accounting firms are a big part of who I build for — reconciliations, month-end close, client statements, and engagement-letter generation are all common starting points.",
  },
  {
    keywords: ["hire", "developer", "different", "why you", "why not"],
    answer:
      "Compared to a general dev shop, I actually work inside month-end close and reconciliation workflows day to day — so the automations are built by someone who understands the accounting logic, not just the code.",
  },
];

export function matchFaq(userText) {
  const text = userText.toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const entry of FAQ_ENTRIES) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (text.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (best) return best.answer;

  return "I don't have a scripted answer for that one — the fastest way to get a real answer is the contact form below, or email/call directly. Narek follows up personally within one business day.";
}
