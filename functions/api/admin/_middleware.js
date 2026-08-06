import { requireBasicAuth } from "../../_utils.js";

export async function onRequest({ request, env, next }) {
  const unauthorized = await requireBasicAuth(request, env);
  return unauthorized || next();
}
