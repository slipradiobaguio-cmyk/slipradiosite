import { jsonResponse } from "../../_utils.js";
import { sendEmail } from "../../_email.js";

export async function onRequestPost({ request, env }) {
  const { to, subject, message } = await request.json().catch(() => ({}));
  if (!to || !subject || !message) {
    return jsonResponse({ error: "to, subject, and message are required" }, 400);
  }

  const result = await sendEmail({ to, subject, text: message, replyTo: env.ADMIN_NOTIFY_EMAIL }, env);
  // 422, not 502/5xx — Cloudflare's edge intercepts 5xx responses from Functions
  // and replaces the body with its own generic error page, hiding the real reason
  if (!result.sent) return jsonResponse({ error: result.reason }, 422);

  return jsonResponse({ sent: true });
}
