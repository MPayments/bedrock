import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import type { AuthAudience } from "../../contracts";
import { AUTH_AUDIENCE_HEADER } from "../shared/audience";
import {
  createAnonymousSessionSnapshot,
  parseSessionSnapshot,
  type SessionSnapshotByAudience,
} from "../shared/session-snapshots";
import type {} from "./next-server";

function resolveApiUrl(apiUrl?: string) {
  return apiUrl ?? process.env.API_INTERNAL_URL ?? "http://localhost:3000";
}

export async function fetchAudienceSessionSnapshot<
  Audience extends AuthAudience,
>(input: {
  apiUrl?: string;
  audience: Audience;
  cookie: string;
  fetchImpl?: typeof fetch;
}): Promise<SessionSnapshotByAudience[Audience]> {
  const fetchImpl = input.fetchImpl ?? fetch;
  let sessionResponse: Response;

  try {
    sessionResponse = await fetchImpl(
      `${resolveApiUrl(input.apiUrl)}/api/auth/${input.audience}/session-snapshot`,
      {
        cache: "no-store",
        headers: {
          cookie: input.cookie,
          [AUTH_AUDIENCE_HEADER]: input.audience,
        },
      },
    );
  } catch {
    return createAnonymousSessionSnapshot(input.audience);
  }

  if (!sessionResponse.ok) {
    return createAnonymousSessionSnapshot(input.audience);
  }

  const sessionPayload = await sessionResponse.json().catch(() => null);
  const parsedSession = parseSessionSnapshot(input.audience, sessionPayload);

  return parsedSession ?? createAnonymousSessionSnapshot(input.audience);
}

interface AudienceProxyContext<Audience extends AuthAudience> {
  getSession: () => Promise<SessionSnapshotByAudience[Audience]>;
  next: () => NextResponse;
  pathname: string;
  redirect: (path: string) => NextResponse;
  request: NextRequest;
}

export function createAudienceProxy<Audience extends AuthAudience>(input: {
  audience: Audience;
  handle: (
    context: AudienceProxyContext<Audience>,
  ) => Promise<NextResponse | null | undefined> | NextResponse | null | undefined;
  loadSession?: (request: NextRequest) => Promise<SessionSnapshotByAudience[Audience]>;
}) {
  return async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const audienceHeaders = new Headers(request.headers);
    audienceHeaders.set(AUTH_AUDIENCE_HEADER, input.audience);

    const next = () =>
      NextResponse.next({
        request: {
          headers: audienceHeaders,
        },
      });
    const redirect = (path: string) =>
      NextResponse.redirect(new URL(path, request.url));
    let sessionPromise: Promise<SessionSnapshotByAudience[Audience]> | null = null;
    const getSession = () => {
      sessionPromise ??=
        input.loadSession?.(request) ??
        fetchAudienceSessionSnapshot({
          audience: input.audience,
          cookie: request.headers.get("cookie") ?? "",
        });
      return sessionPromise;
    };

    if (pathname.startsWith("/api/auth/") || pathname.startsWith("/v1/")) {
      return next();
    }

    const response = await input.handle({
      getSession,
      next,
      pathname,
      redirect,
      request,
    });

    return response ?? next();
  };
}
