import type { RequestContext } from "./request-context";

export function getRequestContext(c: {
  get: (key: "requestContext") => RequestContext | undefined;
}) {
  return c.get("requestContext");
}

function requireIdempotencyKey(c: {
  get: (key: "requestContext") => RequestContext | undefined;
  json: (body: unknown, status?: number) => any;
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
    json: (body: unknown, status?: number) => any;
  },
  run: (idempotencyKey: string) => Promise<TResult>,
): Promise<TResult | any> {
  const idem = requireIdempotencyKey(c);
  if (!idem.ok) {
    return idem.response;
  }

  return run(idem.idempotencyKey);
}
