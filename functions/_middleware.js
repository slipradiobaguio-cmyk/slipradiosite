// _headers alone hasn't been reliably applying its /js/* and /css/* rules on
// this project (only the /* block seems to stick), which lets browsers cache
// a stale stylesheet/script for hours after a visual deploy. Setting the
// header here, in code, at the response layer instead.
export async function onRequest({ request, next }) {
  const response = await next();
  const { pathname } = new URL(request.url);
  if (pathname.startsWith("/css/") || pathname.startsWith("/js/")) {
    const patched = new Response(response.body, response);
    patched.headers.set("Cache-Control", "no-cache");
    return patched;
  }
  return response;
}
