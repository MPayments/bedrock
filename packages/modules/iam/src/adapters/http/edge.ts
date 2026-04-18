import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  admin as adminPlugin,
  openAPI as openApiPlugin,
  twoFactor,
} from "better-auth/plugins";
import { randomBytes } from "node:crypto";

import type { Database } from "@bedrock/platform/persistence";

import type { IamService } from "../../application";
import {
  ac,
  admin,
  agent,
  customer,
  finance,
  user,
} from "../../application/access-policy";
import { UserNotFoundError } from "../../errors";
import {
  AUTH_AUDIENCE_VALUES,
  type AuthAudience,
  type User,
} from "../../contracts";
import {
  AUTH_AUDIENCE_HEADER,
  AUTH_AUDIENCES,
} from "../shared/audience";
import {
  createAnonymousSessionSnapshot,
  mapCustomerSummaries,
  mapSession,
  mapUser,
  type PortalProfileSnapshot,
} from "../shared/session-snapshots";
import {
  betterAuthSchema,
  betterAuthSessionAdditionalFields,
} from "../better-auth";
import {
  DrizzleCustomerMembershipReads,
  DrizzlePortalAccessGrantReads,
  DrizzleUserAccountRepository,
} from "../drizzle";
import {
  CrmSessionSnapshotSchema,
  FinanceAuthSessionSnapshotSchema,
  PortalSessionSnapshotSchema,
} from "../../contracts";

interface AuthSurfaceConfig {
  appName: string;
  basePath: string;
  cookiePrefix: string;
  defaultTrustedOrigins: string[];
}

const AUTH_SURFACE_CONFIG: Record<AuthAudience, AuthSurfaceConfig> = {
  crm: {
    appName: "Bedrock CRM",
    basePath: "/api/auth/crm",
    cookiePrefix: "bedrock-crm",
    defaultTrustedOrigins: ["http://localhost:3002"],
  },
  finance: {
    appName: "Bedrock Finance",
    basePath: "/api/auth/finance",
    cookiePrefix: "bedrock-finance",
    defaultTrustedOrigins: ["http://localhost:3001"],
  },
  portal: {
    appName: "Bedrock Portal",
    basePath: "/api/auth/portal",
    cookiePrefix: "bedrock-portal",
    defaultTrustedOrigins: ["http://localhost:3003"],
  },
};

export interface CreateIamHttpEdgeInput {
  auth: {
    audiences?: Partial<
      Record<
        AuthAudience,
        {
          baseUrl?: string;
          trustedOrigins?: string[];
        }
      >
    >;
    baseUrl?: string;
    nodeEnv?: string;
    secret: string;
    trustedOrigins?: string[];
  };
  db: Database;
  getPortalProfile: (input: { userId: string }) => Promise<PortalProfileSnapshot>;
  iamService: IamService;
}

export interface ValidatedSessionResult {
  audience: AuthAudience;
  session: NonNullable<AuthSession>;
}

export interface ResolvedAuthSurface {
  api: {
    getSession: (input: { headers: Headers }) => Promise<AuthSession>;
  };
  handler: (request: Request) => Promise<Response>;
}

function parseOrigins(value: string[] | undefined, fallback: string[]) {
  if (!value || value.length === 0) {
    return fallback;
  }

  const origins = value
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : fallback;
}

function getTrustedOrigins(
  audience: AuthAudience,
  auth: CreateIamHttpEdgeInput["auth"],
) {
  return parseOrigins(
    auth.audiences?.[audience]?.trustedOrigins ?? auth.trustedOrigins,
    AUTH_SURFACE_CONFIG[audience].defaultTrustedOrigins,
  );
}

function getBaseUrl(
  audience: AuthAudience,
  auth: CreateIamHttpEdgeInput["auth"],
) {
  return (
    auth.audiences?.[audience]?.baseUrl ??
    auth.baseUrl ??
    AUTH_SURFACE_CONFIG[audience].defaultTrustedOrigins[0]!
  );
}

function isAuthAudience(value: string | null | undefined): value is AuthAudience {
  return (
    typeof value === "string" &&
    (AUTH_AUDIENCES as readonly string[]).includes(value)
  );
}

let resolvedDevBetterAuthSecret: string | null = null;

function resolveBetterAuthSecret(input: CreateIamHttpEdgeInput["auth"]) {
  const configuredSecret = input.secret;
  const isProduction = input.nodeEnv === "production";

  if (configuredSecret.length >= 32) {
    return configuredSecret;
  }

  if (isProduction) {
    throw new Error(
      "BETTER_AUTH_SECRET must be at least 32 characters long in production.",
    );
  }

  resolvedDevBetterAuthSecret ??= randomBytes(48).toString("base64url");
  return resolvedDevBetterAuthSecret;
}

async function hasActivePortalMembership(
  customerMembershipReads: DrizzleCustomerMembershipReads,
  userId: string,
) {
  const memberships = await customerMembershipReads.listByUserId(userId);
  return memberships.some((membership) => membership.status === "active");
}

async function resolveAudienceAccess(input: {
  audience: AuthAudience;
  customerMembershipReads: DrizzleCustomerMembershipReads;
  portalAccessGrantReads: DrizzlePortalAccessGrantReads;
  userAccountRepository: DrizzleUserAccountRepository;
  userId: string;
}) {
  const user = await input.userAccountRepository.findById(input.userId);
  if (!user) {
    return {
      allowed: false,
      message: "Учетная запись не найдена.",
    };
  }

  const snapshot = user.toSnapshot();
  if (snapshot.banned) {
    return {
      allowed: false,
      message: "Доступ запрещен.",
    };
  }

  if (input.audience === "finance") {
    return {
      allowed: snapshot.role === "admin" || snapshot.role === "finance",
      message: "У вас нет доступа в Treasury.",
    };
  }

  if (input.audience === "crm") {
    return {
      allowed: snapshot.role === "admin" || snapshot.role === "agent",
      message: "У вас нет доступа в CRM.",
    };
  }

  const [hasMembership, hasPendingGrant] = await Promise.all([
    hasActivePortalMembership(input.customerMembershipReads, input.userId),
    input.portalAccessGrantReads.hasPendingGrant(input.userId),
  ]);

  return {
    allowed: hasMembership || hasPendingGrant,
    message: "У вас нет доступа в портал.",
  };
}

function createAudiencePolicyPlugin(input: {
  audience: AuthAudience;
  customerMembershipReads: DrizzleCustomerMembershipReads;
  portalAccessGrantReads: DrizzlePortalAccessGrantReads;
  userAccountRepository: DrizzleUserAccountRepository;
}) {
  return {
    id: `audience-policy-${input.audience}`,
    init() {
      return {
        options: {
          databaseHooks: {
            session: {
              create: {
                async before(session: Record<string, unknown>) {
                  const userId = String(session.userId ?? "");
                  const access = await resolveAudienceAccess({
                    audience: input.audience,
                    customerMembershipReads: input.customerMembershipReads,
                    portalAccessGrantReads: input.portalAccessGrantReads,
                    userAccountRepository: input.userAccountRepository,
                    userId,
                  });

                  if (!access.allowed) {
                    throw new APIError("FORBIDDEN", {
                      message: access.message,
                    });
                  }

                  return {
                    data: {
                      audience: input.audience,
                    },
                  };
                },
              },
            },
          },
        },
      };
    },
  };
}

function createAuthSurface(input: {
  audience: AuthAudience;
  auth: CreateIamHttpEdgeInput["auth"];
  customerMembershipReads: DrizzleCustomerMembershipReads;
  db: Database;
  portalAccessGrantReads: DrizzlePortalAccessGrantReads;
  userAccountRepository: DrizzleUserAccountRepository;
}) {
  const config = AUTH_SURFACE_CONFIG[input.audience];

  return betterAuth({
    appName: config.appName,
    secret: resolveBetterAuthSecret(input.auth),
    baseURL: getBaseUrl(input.audience, input.auth),
    basePath: config.basePath,
    trustedOrigins: getTrustedOrigins(input.audience, input.auth),
    trustedHeaders: ["cookie", AUTH_AUDIENCE_HEADER],
    advanced: {
      cookiePrefix: config.cookiePrefix,
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
    },
    session: {
      additionalFields: betterAuthSessionAdditionalFields,
    },
    database: drizzleAdapter(input.db, {
      provider: "pg",
      schema: betterAuthSchema,
    }),
    plugins: [
      createAudiencePolicyPlugin({
        audience: input.audience,
        customerMembershipReads: input.customerMembershipReads,
        portalAccessGrantReads: input.portalAccessGrantReads,
        userAccountRepository: input.userAccountRepository,
      }),
      openApiPlugin(),
      adminPlugin({
        ac,
        roles: {
          admin,
          agent,
          customer,
          finance,
          user,
        },
      }),
      twoFactor({
        issuer: config.appName,
        skipVerificationOnEnable: false,
      }),
    ],
  });
}

type AppAuth = ReturnType<typeof createAuthSurface>;

export type AuthSession = Awaited<ReturnType<AppAuth["api"]["getSession"]>>;

export async function getValidatedSessionForAudienceFromSurfaces(input: {
  audience: AuthAudience;
  authByAudience: Record<AuthAudience, ResolvedAuthSurface>;
  headers: Headers;
}): Promise<AuthSession> {
  try {
    const auth = input.authByAudience[input.audience];
    const session = await auth.api.getSession({
      headers: input.headers,
    });

    if (!session) {
      return null;
    }

    if (
      session.session.audience &&
      session.session.audience !== input.audience
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function getValidatedSessionFromSurfaces(input: {
  authByAudience: Record<AuthAudience, ResolvedAuthSurface>;
  headers: Headers;
}): Promise<ValidatedSessionResult | null> {
  const requestedAudience = input.headers.get(AUTH_AUDIENCE_HEADER);
  if (isAuthAudience(requestedAudience)) {
    const session = await getValidatedSessionForAudienceFromSurfaces({
      audience: requestedAudience,
      authByAudience: input.authByAudience,
      headers: input.headers,
    });

    return session
      ? {
          audience: requestedAudience,
          session,
        }
      : null;
  }

  const resolvedSessions = await Promise.all(
    AUTH_AUDIENCE_VALUES.map(async (audience) => {
      const session = await getValidatedSessionForAudienceFromSurfaces({
        audience,
        authByAudience: input.authByAudience,
        headers: input.headers,
      });

      return session
        ? {
            audience,
            session,
          }
        : null;
    }),
  );

  const matches = resolvedSessions.filter(
    (session): session is ValidatedSessionResult => session !== null,
  );

  return matches.length === 1 ? (matches[0] ?? null) : null;
}

async function findCurrentUser(
  iamService: IamService,
  userId: string,
): Promise<User | null> {
  try {
    return await iamService.queries.findById(userId);
  } catch (error) {
    if (error instanceof UserNotFoundError) {
      return null;
    }

    throw error;
  }
}

export async function buildSessionSnapshotForAudienceFromSurfaces(input: {
  audience: AuthAudience;
  authByAudience: Record<AuthAudience, ResolvedAuthSurface>;
  getPortalProfile: CreateIamHttpEdgeInput["getPortalProfile"];
  headers: Headers;
  iamService: IamService;
}) {
  const authSession = await getValidatedSessionForAudienceFromSurfaces({
    audience: input.audience,
    authByAudience: input.authByAudience,
    headers: input.headers,
  });

  if (!authSession) {
    return createAnonymousSessionSnapshot(input.audience);
  }

  const currentUser = await findCurrentUser(
    input.iamService,
    authSession.user.id,
  );
  if (!currentUser) {
    return createAnonymousSessionSnapshot(input.audience);
  }

  if (input.audience === "finance") {
    return FinanceAuthSessionSnapshotSchema.parse({
      audience: "finance",
      isAuthenticated: true,
      requiresTwoFactorSetup: !currentUser.twoFactorEnabled,
      role: currentUser.role === "admin" ? "admin" : "finance",
      session: mapSession(authSession.session),
      user: mapUser(authSession.user),
    });
  }

  const profile = await input.getPortalProfile({
    userId: authSession.user.id,
  });

  if (input.audience === "crm") {
    return CrmSessionSnapshotSchema.parse({
      audience: "crm",
      canAccessDashboard: true,
      customerPortalCustomers: mapCustomerSummaries(profile.customers),
      hasCustomerPortalAccess: profile.hasCustomerPortalAccess,
      isAuthenticated: true,
      role: currentUser.role === "admin" ? "admin" : "agent",
      session: mapSession(authSession.session),
      user: mapUser(authSession.user),
    });
  }

  return PortalSessionSnapshotSchema.parse({
    audience: "portal",
    canAccessDashboard:
      currentUser.role === "admin" || currentUser.role === "agent",
    customerPortalCustomers: mapCustomerSummaries(profile.customers),
    hasCustomerPortalAccess: profile.hasCustomerPortalAccess,
    hasOnboardingAccess: profile.hasOnboardingAccess,
    isAuthenticated: true,
    role: currentUser.role,
    session: mapSession(authSession.session),
    user: mapUser(authSession.user),
  });
}

export function createIamHttpEdge(input: CreateIamHttpEdgeInput) {
  const userAccountRepository = new DrizzleUserAccountRepository(input.db);
  const customerMembershipReads = new DrizzleCustomerMembershipReads(input.db);
  const portalAccessGrantReads = new DrizzlePortalAccessGrantReads(input.db);

  const authByAudience = {
    crm: createAuthSurface({
      audience: "crm",
      auth: input.auth,
      customerMembershipReads,
      db: input.db,
      portalAccessGrantReads,
      userAccountRepository,
    }),
    finance: createAuthSurface({
      audience: "finance",
      auth: input.auth,
      customerMembershipReads,
      db: input.db,
      portalAccessGrantReads,
      userAccountRepository,
    }),
    portal: createAuthSurface({
      audience: "portal",
      auth: input.auth,
      customerMembershipReads,
      db: input.db,
      portalAccessGrantReads,
      userAccountRepository,
    }),
  } satisfies Record<AuthAudience, AppAuth>;

  async function getValidatedSessionForAudience(inputValue: {
    audience: AuthAudience;
    headers: Headers;
  }) {
    return getValidatedSessionForAudienceFromSurfaces({
      audience: inputValue.audience,
      authByAudience,
      headers: inputValue.headers,
    });
  }

  async function getValidatedSession(inputValue: { headers: Headers }) {
    return getValidatedSessionFromSurfaces({
      authByAudience,
      headers: inputValue.headers,
    });
  }

  async function buildSessionSnapshotForAudience(inputValue: {
    audience: AuthAudience;
    headers: Headers;
  }) {
    return buildSessionSnapshotForAudienceFromSurfaces({
      audience: inputValue.audience,
      authByAudience,
      getPortalProfile: input.getPortalProfile,
      headers: inputValue.headers,
      iamService: input.iamService,
    });
  }

  return {
    authByAudience,
    getValidatedSession,
    getValidatedSessionForAudience,
    buildSessionSnapshotForAudience,
  };
}
