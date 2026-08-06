export async function onRequestDelete({ params, env }) {
  await env.SUBMISSIONS.delete(`slot:${params.id}`);
  return new Response(null, { status: 204 });
}
