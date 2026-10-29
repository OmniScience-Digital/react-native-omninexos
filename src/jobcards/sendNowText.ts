// src/jobcards/sendNowText.ts
// The words the technician sees after tapping "Send now". Plain, and honest about having no signal.
import type { SendNowResult } from "./controller";

export const SEND_NOTE =
  "Open the app once before you leave the site, and don't swipe it away, so it can finish sending.";

export function sendNowMessage(r: SendNowResult): string {
  switch (r.status) {
    case "offline":
      return "No signal right now. Your work is saved on this phone and will send by itself when you are back online.";
    case "sent":
      return r.sent === 1 ? "Sent." : `Sent ${r.sent} results.`;
    case "nothing":
      return "Everything is already sent.";
    case "waiting":
      return `${r.waiting} still waiting. It will try again by itself.`;
    case "error":
      return "Could not send right now. Your work is safe on this phone and will try again.";
  }
}
