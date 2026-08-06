const RESEND_API_URL = "https://api.resend.com/emails";

// no-ops (rather than throwing) when RESEND_API_KEY isn't set yet, so
// submissions/admin actions still succeed while email delivery is pending setup
export async function sendEmail({ to, subject, text, replyTo }, env) {
  if (!env.RESEND_API_KEY) return { sent: false, reason: "email isn't configured yet" };

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM || "slip radio <onboarding@resend.dev>",
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { sent: false, reason: `resend ${res.status}: ${body}` };
  }

  return { sent: true };
}
