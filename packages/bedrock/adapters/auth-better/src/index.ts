import {
  ExecutionContextToken,
  defineHttpMount,
  defineModule,
  defineProvider,
  type HttpMountDescriptor,
  type ModuleDescriptor,
  type Provider,
  type RuntimeHttpRequest,
  webResponseToRuntimeHttpResult,
  token,
} from "@bedrock/core";
import {
  AuthContextToken,
  OptionalActorToken,
  createAuthContext,
  mergeActorClaims,
  type AccessScopeRef,
  type Actor,
  type ActorClaims,
  type PermissionGrant,
  type RoleGrant,
} from "@bedrock/security";
import type { Auth } from "better-auth";

export type BetterAuthInstance = Auth<any>;
export type BetterAuthApi = BetterAuthInstance["api"];

type BetterAuthRequestContext = {
  session: unknown | null;
  user: unknown | null;
  headers: Headers;
};

type BetterAuthApiKeyContext = {
  apiKey: unknown | null;
  headers: Headers;
};

type BetterAuthResolvedGrants = {
  activeScope?: AccessScopeRef;
  roles?: readonly RoleGrant[];
  permissions?: readonly PermissionGrant[];
  claims?: Readonly<Record<string, ActorClaims>>;
};

type BetterAuthActorResolverArgs<TAuth extends BetterAuthInstance = BetterAuthInstance> = {
  auth: TAuth;
  request: RuntimeHttpRequest;
  requestContext: BetterAuthRequestContext;
  apiKeyContext: BetterAuthApiKeyContext;
  grants: BetterAuthResolvedGrants | null;
};

type BetterAuthSessionActorResolver<
  TAuth extends BetterAuthInstance = BetterAuthInstance,
> = (
  args: BetterAuthActorResolverArgs<TAuth>,
) => Promise<Actor | null> | Actor | null;

type BetterAuthApiKeyActorResolver<
  TAuth extends BetterAuthInstance = BetterAuthInstance,
> = (
  args: BetterAuthActorResolverArgs<TAuth>,
) => Promise<Actor | null> | Actor | null;

type BetterAuthGrantResolver<
  TAuth extends BetterAuthInstance = BetterAuthInstance,
> = (
  args: Omit<BetterAuthActorResolverArgs<TAuth>, "grants">,
) => Promise<BetterAuthResolvedGrants | null> | BetterAuthResolvedGrants | null;

type BetterAuthApiKeyResolver<
  TAuth extends BetterAuthInstance = BetterAuthInstance,
> = (args: {
  auth: TAuth;
  request: RuntimeHttpRequest;
  headers: Headers;
}) => Promise<unknown | null> | unknown | null;

export type BetterAuthRequestContextTokenValue = BetterAuthRequestContext;
export type BetterAuthApiKeyContextTokenValue = BetterAuthApiKeyContext;
export type BetterAuthGrantSet = BetterAuthResolvedGrants;

export type BetterAuthAdapterOptions<
  TAuth extends BetterAuthInstance = BetterAuthInstance,
> = {
  auth: TAuth;
  mount?:
    | false
    | {
        basePath?: string;
        name?: string;
      };
  actor?: {
    fromSession?: BetterAuthSessionActorResolver<TAuth>;
    fromApiKey?: BetterAuthApiKeyActorResolver<TAuth>;
  };
  grants?: {
    resolve?: BetterAuthGrantResolver<TAuth>;
  };
  apiKeys?: {
    sessionMocking?: false | "user-owned-only";
    resolve?: BetterAuthApiKeyResolver<TAuth>;
  };
};

export const BetterAuthToken = token<BetterAuthInstance>(
  "bedrock.better-auth.instance",
);

export const BetterAuthApiToken = token<BetterAuthApi>(
  "bedrock.better-auth.api",
);

export const BetterAuthRequestContextToken = token<BetterAuthRequestContext>(
  "bedrock.better-auth.request-context",
);

export const BetterAuthApiKeyContextToken = token<BetterAuthApiKeyContext>(
  "bedrock.better-auth.api-key-context",
);

const BetterAuthGrantSetToken = token<BetterAuthResolvedGrants | null>(
  "bedrock.better-auth.grant-set",
);

const EMPTY_HEADERS = new Headers();
type WebBodyInit =
  | NonNullable<RequestInit["body"]>
  | Uint8Array<ArrayBufferLike>;

export function createBetterAuthProviders<TAuth extends BetterAuthInstance>(
  options: BetterAuthAdapterOptions<TAuth>,
): readonly Provider[] {
  return [
    defineProvider({
      provide: BetterAuthToken,
      useValue: options.auth,
    }),
    defineProvider({
      provide: BetterAuthApiToken,
      useValue: options.auth.api,
    }),
    defineProvider({
      provide: BetterAuthRequestContextToken,
      scope: "request",
      deps: {
        executionContext: ExecutionContextToken,
        auth: BetterAuthToken,
      },
      useFactory: async ({ executionContext, auth }) => {
        if (executionContext.kind !== "http" || !executionContext.http) {
          return {
            session: null,
            user: null,
            headers: EMPTY_HEADERS,
          };
        }

        const headers = createHeaders(executionContext.http.request.headers);
        const sessionResult = await auth.api.getSession({ headers });

        return {
          session: sessionResult?.session ?? null,
          user: sessionResult?.user ?? null,
          headers,
        };
      },
    }),
    defineProvider({
      provide: BetterAuthApiKeyContextToken,
      scope: "request",
      deps: {
        executionContext: ExecutionContextToken,
        auth: BetterAuthToken,
      },
      useFactory: async ({ executionContext, auth }) => {
        if (executionContext.kind !== "http" || !executionContext.http) {
          return {
            apiKey: null,
            headers: EMPTY_HEADERS,
          };
        }

        const request = executionContext.http.request;
        const headers = createHeaders(request.headers);
        const apiKey = options.apiKeys?.resolve
          ? await options.apiKeys.resolve({
              auth: auth as TAuth,
              request,
              headers,
            })
          : null;

        return {
          apiKey: apiKey ?? null,
          headers,
        };
      },
    }),
    defineProvider({
      provide: BetterAuthGrantSetToken,
      scope: "request",
      deps: {
        executionContext: ExecutionContextToken,
        auth: BetterAuthToken,
        requestContext: BetterAuthRequestContextToken,
        apiKeyContext: BetterAuthApiKeyContextToken,
      },
      useFactory: async ({
        executionContext,
        auth,
        requestContext,
        apiKeyContext,
      }) => {
        if (
          executionContext.kind !== "http" ||
          !executionContext.http ||
          !options.grants?.resolve
        ) {
          return null;
        }

        return (
          (await options.grants.resolve({
            auth: auth as TAuth,
            request: executionContext.http.request,
            requestContext,
            apiKeyContext,
          })) ?? null
        );
      },
    }),
    defineProvider({
      provide: OptionalActorToken,
      scope: "request",
      deps: {
        executionContext: ExecutionContextToken,
        auth: BetterAuthToken,
        requestContext: BetterAuthRequestContextToken,
        apiKeyContext: BetterAuthApiKeyContextToken,
        grants: BetterAuthGrantSetToken,
      },
      useFactory: async ({
        executionContext,
        auth,
        requestContext,
        apiKeyContext,
        grants,
      }) => {
        if (executionContext.kind !== "http" || !executionContext.http) {
          return null;
        }

        const actorArgs: BetterAuthActorResolverArgs<TAuth> = {
          auth: auth as TAuth,
          request: executionContext.http.request,
          requestContext,
          apiKeyContext,
          grants,
        };

        const sessionActor = await resolveSessionActor(options, actorArgs);
        if (sessionActor) {
          return mergeGrantSet(sessionActor, grants);
        }

        const apiKeyActor = await resolveApiKeyActor(options, actorArgs);
        if (apiKeyActor) {
          return mergeGrantSet(apiKeyActor, grants);
        }

        return null;
      },
    }),
    defineProvider({
      provide: AuthContextToken,
      scope: "request",
      deps: {
        actor: OptionalActorToken,
      },
      useFactory: ({ actor }) => createAuthContext(actor),
    }),
  ];
}

export function createBetterAuthMount<TAuth extends BetterAuthInstance>(options: {
  auth: TAuth;
  basePath?: string;
  name?: string;
}): HttpMountDescriptor {
  return defineHttpMount(options.name ?? "better-auth", {
    basePath: options.basePath ?? "/api/auth",
    async handle(request) {
      const response = await options.auth.handler(toWebRequest(request));
      return webResponseToRuntimeHttpResult(response);
    },
  });
}

export function createBetterAuthModule<TAuth extends BetterAuthInstance>(
  name: string,
  options: BetterAuthAdapterOptions<TAuth>,
): ModuleDescriptor {
  return defineModule(name, {
    providers: createBetterAuthProviders(options),
    httpMounts:
      options.mount === false
        ? []
        : [
            createBetterAuthMount({
              auth: options.auth,
              basePath: options.mount?.basePath,
              name: options.mount?.name,
            }),
          ],
  });
}

function mergeGrantSet(
  actor: Actor,
  grants: BetterAuthResolvedGrants | null,
): Actor {
  if (!grants) {
    return actor;
  }

  return {
    ...actor,
    activeScope: grants.activeScope ?? actor.activeScope,
    roles: Object.freeze([...(actor.roles ?? []), ...(grants.roles ?? [])]),
    permissions: Object.freeze([
      ...(actor.permissions ?? []),
      ...(grants.permissions ?? []),
    ]),
    claims: mergeActorClaims(actor.claims, grants.claims),
  };
}

async function resolveSessionActor<TAuth extends BetterAuthInstance>(
  options: BetterAuthAdapterOptions<TAuth>,
  args: BetterAuthActorResolverArgs<TAuth>,
): Promise<Actor | null> {
  if (!args.requestContext.session || !args.requestContext.user) {
    return null;
  }

  if (
    args.apiKeyContext.apiKey &&
    !allowsApiKeySession(
      args.apiKeyContext.apiKey,
      options.apiKeys?.sessionMocking ?? false,
    )
  ) {
    return null;
  }

  if (options.actor?.fromSession) {
    return options.actor.fromSession(args);
  }

  return createDefaultSessionActor(args.requestContext);
}

async function resolveApiKeyActor<TAuth extends BetterAuthInstance>(
  options: BetterAuthAdapterOptions<TAuth>,
  args: BetterAuthActorResolverArgs<TAuth>,
): Promise<Actor | null> {
  if (!args.apiKeyContext.apiKey || !options.actor?.fromApiKey) {
    return null;
  }

  return options.actor.fromApiKey(args);
}

function createDefaultSessionActor(
  requestContext: BetterAuthRequestContext,
): Actor | null {
  const userId = readStringField(requestContext.user, "id");

  if (!userId) {
    return null;
  }

  return {
    kind: "user",
    subject: {
      id: userId,
    },
    sessionId: readStringField(requestContext.session, "id") ?? undefined,
    roles: [],
    permissions: [],
    claims: Object.freeze({
      ...pickClaim(requestContext.user, "email"),
      ...pickClaim(requestContext.user, "emailVerified"),
      ...pickClaim(requestContext.user, "name"),
      ...pickClaim(requestContext.user, "image"),
    }),
  };
}

function allowsApiKeySession(
  apiKey: unknown,
  sessionMocking: false | "user-owned-only",
): boolean {
  if (sessionMocking !== "user-owned-only") {
    return false;
  }

  return readStringField(apiKey, "ownerType") === "user";
}

function readStringField(value: unknown, key: string): string | null {
  if (!isRecord(value) || typeof value[key] !== "string") {
    return null;
  }

  return value[key];
}

function pickClaim(
  value: unknown,
  key: string,
): Readonly<Record<string, ActorClaims>> {
  if (!isRecord(value) || !(key in value)) {
    return {};
  }

  const claim = value[key];
  if (
    claim === null ||
    typeof claim === "string" ||
    typeof claim === "number" ||
    typeof claim === "boolean"
  ) {
    return {
      [key]: claim,
    };
  }

  if (
    Array.isArray(claim) &&
    claim.every(
      (entry) =>
        entry === null ||
        typeof entry === "string" ||
        typeof entry === "number" ||
        typeof entry === "boolean",
    )
  ) {
    return {
      [key]: Object.freeze([...claim]),
    };
  }

  return {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createHeaders(headers: Record<string, string>): Headers {
  const values = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    values.set(key, value);
  }

  return values;
}

function toWebRequest(request: RuntimeHttpRequest): Request {
  if (request.raw instanceof Request) {
    return request.raw;
  }

  const headers = createHeaders(request.headers);
  const init: RequestInit & {
    duplex?: "half";
  } = {
    method: request.method,
    headers,
  };

  const body = readRawBodyInit(request.raw);

  if (body !== undefined && request.method !== "GET" && request.method !== "HEAD") {
    init.body = body as RequestInit["body"];
    init.duplex = "half";
  }

  return new Request(request.url, init);
}

function readRawBodyInit(raw: unknown): WebBodyInit | undefined {
  if (!raw || typeof raw !== "object" || !("body" in raw)) {
    return undefined;
  }

  const body = (raw as { body?: unknown }).body;

  if (body === undefined || body === null) {
    return undefined;
  }

  if (body instanceof Uint8Array || body instanceof ArrayBuffer || typeof body === "string") {
    return body;
  }

  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }

  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return body;
  }

  return undefined;
}

export type {
  BetterAuthApiKeyActorResolver,
  BetterAuthApiKeyContext,
  BetterAuthApiKeyResolver,
  BetterAuthActorResolverArgs,
  BetterAuthGrantResolver,
  BetterAuthRequestContext,
  BetterAuthResolvedGrants,
  BetterAuthSessionActorResolver,
};
