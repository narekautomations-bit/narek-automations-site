// Swap these values for your real contact details before launch.
export const CONTACT_EMAIL = "narekautomations@gmail.com";
export const CONTACT_PHONE = "(818) 433-2928"; // display form
// Canonical E.164 form, used for both tel: and sms: links. Keep the +1 —
// some phones (and most Android SMS handlers) won't resolve an sms: link
// without a country code.
export const CONTACT_PHONE_E164 = "+18184332928";

// Backend seams — leave both null for the static v1 (no server required).
// Wiring instructions live in README.md.
export const CHAT_BACKEND_URL = null; // e.g. "/.netlify/functions/chat"
export const FORM_BACKEND_URL = null; // only needed if you move off Netlify Forms
