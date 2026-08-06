export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// fixed-length digest compare so a match doesn't return faster than a
// mismatch — guards the admin password and webhook secret against timing attacks
export async function timingSafeEqual(a, b) {
  const digest = async (s) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s))));
  const [da, db] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= da[i] ^ db[i];
  return diff === 0 && a.length === b.length;
}

// leaves the route open if no password is configured yet, rather than locking everyone out
export async function requireBasicAuth(request, env) {
  if (!env.ADMIN_PASSWORD) return null;

  const header = request.headers.get("Authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [user, pass] = atob(encoded).split(":");
    const userOk = await timingSafeEqual(user || "", env.ADMIN_USER || "admin");
    const passOk = await timingSafeEqual(pass || "", env.ADMIN_PASSWORD);
    if (userOk && passOk) return null;
  }

  return new Response("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Slip Radio Admin"' },
  });
}

// strips control chars and collapses whitespace, then hard-caps length —
// used for both chat names and message bodies, just with a different maxLen
export function sanitizeText(input, maxLen) {
  if (typeof input !== "string") return "";
  const printable = Array.from(input)
    .map((ch) => (ch.codePointAt(0) < 32 || ch.codePointAt(0) === 127 ? " " : ch))
    .join("");
  return printable.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

export function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "0.0.0.0";
}

// hashed rather than stored raw — enough to rate-limit/ban by IP without
// keeping plaintext addresses around in D1
export async function hashIp(ip) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// treats verification as passed when TURNSTILE_SECRET_KEY isn't set yet —
// same "not wired up yet" no-op pattern as sendEmail's missing RESEND_API_KEY
export async function verifyTurnstile(token, env, ip) {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;

  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (ip) body.set("remoteip", ip);

  const res = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body }).catch(() => null);
  if (!res || !res.ok) return false;
  const data = await res.json().catch(() => null);
  return Boolean(data && data.success);
}
