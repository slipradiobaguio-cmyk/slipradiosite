import { requireBasicAuth } from "../_utils.js";

export async function onRequest({ request, env, next }) {
  const unauthorized = requireBasicAuth(request, env);
  return unauthorized || next();
}
