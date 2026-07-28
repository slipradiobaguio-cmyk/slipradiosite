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
