import type { RequestContext } from "./request-context";

export function getRequestContext(c: {
  get: (key: "requestContext") => RequestContext | undefined;
}) {
  return c.get("requestContext");
}

export function requireIdempotencyKey(c: {
  get: (key: "requestContext") => RequestContext | undefined;
  json: (body: unknown, status?: number) => Response;
}) {
  const key = getRequestContext(c)?.idempotencyKey;
  if (!key) {
    return {
      ok: false as const,
      response: c.json({ error: "Missing Idempotency-Key header" }, 400),
    };
  }

  return {
    ok: true as const,
    idempotencyKey: key,
  };
}

export async function withRequiredIdempotency<TResult>(
  c: {
    get: (key: "requestContext") => RequestContext | undefined;
    json: (body: unknown, status?: number) => Response;
  },
  run: (idempotencyKey: string) => Promise<TResult>,
): Promise<TResult | Response> {
  const idem = requireIdempotencyKey(c);
  if (!idem.ok) {
    return idem.response;
  }

  return run(idem.idempotencyKey);
}
