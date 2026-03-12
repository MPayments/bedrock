import type { MiddlewareHandler } from "hono";

/**
 * Response-phase middleware that sets ETag / Cache-Control headers on 200 GET
 * responses and returns 304 when the client sends a matching If-None-Match.
 *
 * @param extractVersion – pull a version identifier from the parsed JSON body.
 *   Return `undefined` to skip ETag for that response.
 */
export function withEtag(
  extractVersion: (body: Record<string, unknown>) => string | number | undefined,
): MiddlewareHandler {
  return async (c, next) => {
    await next();

    if (c.req.method !== "GET" || c.res.status !== 200) return;

    let body: Record<string, unknown>;
    try {
      body = await c.res.clone().json();
    } catch {
      return;
    }

    const version = extractVersion(body);
    if (version === undefined) return;

    const etag = `"${version}"`;
    c.header("ETag", etag);
    c.header("Cache-Control", "no-cache");

    const ifNoneMatch = c.req.header("If-None-Match");
    if (ifNoneMatch === etag) {
      c.res = new Response(null, { status: 304, headers: c.res.headers });
    }
  };
}
