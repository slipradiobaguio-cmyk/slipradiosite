import { jsonResponse, sanitizeText } from "../../_utils.js";
import { sendEmail } from "../../_email.js";

const REQUIRED = ["email", "djName", "showName", "bio", "instagram", "phone", "location", "genres", "photoUrl", "slotId", "setup"];
const SETUPS = ["digital", "vinyl", "hybrid"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost({ request, env }) {
  const payload = await request.json().catch(() => null);
  if (!payload) return jsonResponse({ error: "Invalid request." }, 400);

  for (const key of REQUIRED) {
    if (!payload[key] || !String(payload[key]).trim()) {
      return jsonResponse({ error: `${key} is required.` }, 400);
    }
  }

  const email = sanitizeText(payload.email, 200).toLowerCase();
  if (!EMAIL_RE.test(email)) return jsonResponse({ error: "That email address doesn't look right." }, 400);
  if (!SETUPS.includes(payload.setup)) return jsonResponse({ error: "Invalid setup choice." }, 400);

  const slotKey = `slot:${payload.slotId}`;
  const slot = await env.SUBMISSIONS.get(slotKey, "json");
  if (!slot || slot.status !== "open") {
    return jsonResponse({ error: "That timeslot is no longer available — please pick another." }, 409);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const record = {
    id,
    email,
    djName: sanitizeText(payload.djName, 100),
    showName: sanitizeText(payload.showName, 100),
    bio: sanitizeText(payload.bio, 1000),
    instagram: sanitizeText(payload.instagram, 100),
    phone: sanitizeText(payload.phone, 50),
    location: sanitizeText(payload.location, 100),
    genres: sanitizeText(payload.genres, 200),
    mixLink: sanitizeText(payload.mixLink || "", 300),
    photoUrl: sanitizeText(payload.photoUrl, 300),
    setup: payload.setup,
    slotId: slot.id,
    slotDate: slot.date,
    slotStart: slot.startTime,
    slotEnd: slot.endTime,
    status: "new",
    createdAt: now,
  };

  await env.SUBMISSIONS.put(`submission:${id}`, JSON.stringify(record));
  await env.SUBMISSIONS.put(slotKey, JSON.stringify({ ...slot, status: "reserved", submissionId: id }));

  const slotText = `${slot.date}, ${slot.startTime}–${slot.endTime}`;
  const notifyEmail = env.ADMIN_NOTIFY_EMAIL;

  await sendEmail(
    {
      to: notifyEmail,
      subject: `New DJ submission — ${record.showName}`,
      text: `${record.djName} (${record.email}) applied to play "${record.showName}" on ${slotText}.\n\nInstagram: ${record.instagram}\nPhone: ${record.phone}\nBased in: ${record.location}\nGenres: ${record.genres}\nSetup: ${record.setup}\nMix link: ${record.mixLink || "—"}\nPhoto: ${record.photoUrl}\n\nBio:\n${record.bio}\n\nReview it at slipradio.live/admin.`,
      replyTo: record.email,
    },
    env
  ).catch(() => {});

  await sendEmail(
    {
      to: record.email,
      subject: "We got your slip radio submission",
      text: `Hi ${record.djName},\n\nThanks for applying to play a set at slip radio! We've reserved ${slotText} for you.\n\nWe'll follow up with studio details and next steps soon. Questions in the meantime? Just reply to this email.\n\n— slip radio`,
      replyTo: notifyEmail,
    },
    env
  ).catch(() => {});

  return jsonResponse({ id }, 201);
}
