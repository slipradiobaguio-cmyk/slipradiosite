export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// leaves the route open if no password is configured yet, rather than locking everyone out
export function requireBasicAuth(request, env) {
  if (!env.ADMIN_PASSWORD) return null;

  const header = request.headers.get("Authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [user, pass] = atob(encoded).split(":");
    if (user === (env.ADMIN_USER || "admin") && pass === env.ADMIN_PASSWORD) return null;
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
