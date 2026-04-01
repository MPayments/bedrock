import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  admin as adminPlugin,
  openAPI as openApiPlugin,
  twoFactor,
} from "better-auth/plugins";
import { randomBytes } from "node:crypto";

import {
  betterAuthSchema,
  betterAuthSessionAdditionalFields,
} from "@bedrock/iam/adapters/better-auth";
import {
  DrizzleCustomerMembershipReads,
  DrizzlePortalAccessGrantReads,
  DrizzleUserAccountRepository,
} from "@bedrock/iam/adapters/drizzle";
import {
  AUTH_AUDIENCE_VALUES,
  type AuthAudience,
} from "@bedrock/iam/contracts";

import { ac, admin, agent, customer, finance, user } from "./permissions";
import { db } from "../db/client";

export const AUTH_AUDIENCE_HEADER = "x-bedrock-app-audience";

export const AUTH_AUDIENCES = AUTH_AUDIENCE_VALUES;

interface AuthSurfaceConfig {
  appName: string;
  basePath: string;
  cookiePrefix: string;
  defaultTrustedOrigins: string[];
}

const userAccountRepository = new DrizzleUserAccountRepository(db);
const customerMembershipReads = new DrizzleCustomerMembershipReads(db);
const portalAccessGrantReads = new DrizzlePortalAccessGrantReads(db);

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

function parseOrigins(value: string | undefined, fallback: string[]) {
  if (!value) {
    return fallback;
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : fallback;
}

function getTrustedOrigins(audience: AuthAudience) {
  const envMap: Record<AuthAudience, string | undefined> = {
    crm: process.env.BETTER_AUTH_CRM_TRUSTED_ORIGINS,
    finance: process.env.BETTER_AUTH_FINANCE_TRUSTED_ORIGINS,
    portal: process.env.BETTER_AUTH_PORTAL_TRUSTED_ORIGINS,
  };

  return parseOrigins(
    envMap[audience] ?? process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    AUTH_SURFACE_CONFIG[audience].defaultTrustedOrigins,
  );
}

function isAuthAudience(value: string | null | undefined): value is AuthAudience {
  return (
    typeof value === "string" &&
    (AUTH_AUDIENCES as readonly string[]).includes(value)
  );
}

let resolvedDevBetterAuthSecret: string | null = null;

function resolveBetterAuthSecret() {
  const configuredSecret = process.env.BETTER_AUTH_SECRET ?? "";
  const isProduction = process.env.NODE_ENV === "production";

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

async function hasActivePortalMembership(userId: string) {
  const memberships = await customerMembershipReads.listByUserId(userId);
  return memberships.some((membership) => membership.status === "active");
}

async function hasPendingPortalGrant(userId: string) {
  return portalAccessGrantReads.hasPendingGrant(userId);
}

async function resolveAudienceAccess(audience: AuthAudience, userId: string) {
  const user = await userAccountRepository.findById(userId);
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

  if (audience === "finance") {
    return {
      allowed: snapshot.role === "admin" || snapshot.role === "finance",
      message: "У вас нет доступа в Treasury.",
    };
  }

  if (audience === "crm") {
    return {
      allowed: snapshot.role === "admin" || snapshot.role === "agent",
      message: "У вас нет доступа в CRM.",
    };
  }

  const [hasMembership, hasPendingGrant] = await Promise.all([
    hasActivePortalMembership(userId),
    hasPendingPortalGrant(userId),
  ]);

  return {
    allowed: hasMembership || hasPendingGrant,
    message: "У вас нет доступа в портал.",
  };
}

function createAudiencePolicyPlugin(audience: AuthAudience) {
  return {
    id: `audience-policy-${audience}`,
    init() {
      return {
        options: {
          databaseHooks: {
            session: {
              create: {
                async before(session: Record<string, unknown>) {
                  const userId = String(session.userId ?? "");
                  const access = await resolveAudienceAccess(audience, userId);

                  if (!access.allowed) {
                    throw new APIError("FORBIDDEN", {
                      message: access.message,
                    });
                  }

                  return {
                    data: {
                      audience,
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

function createAuthSurface(audience: AuthAudience) {
  const config = AUTH_SURFACE_CONFIG[audience];

  return betterAuth({
    appName: config.appName,
    secret: resolveBetterAuthSecret(),
    baseURL: process.env.BETTER_AUTH_URL!,
    basePath: config.basePath,
    trustedOrigins: getTrustedOrigins(audience),
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
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: betterAuthSchema,
    }),
    plugins: [
      createAudiencePolicyPlugin(audience),
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

export const authByAudience = {
  crm: createAuthSurface("crm"),
  finance: createAuthSurface("finance"),
  portal: createAuthSurface("portal"),
} as const;

export type AppAuth = (typeof authByAudience)[AuthAudience];

export type AuthSession = Awaited<
  ReturnType<(typeof authByAudience.crm.api)["getSession"]>
>;

export async function getValidatedSessionForAudience(input: {
  audience: AuthAudience;
  headers: Headers;
}) {
  const auth = authByAudience[input.audience];
  const authSession = await auth.api.getSession({
    headers: input.headers,
  });

  if (!authSession) {
    return null;
  }

  if (authSession.session.audience !== input.audience) {
    return null;
  }

  const access = await resolveAudienceAccess(input.audience, authSession.user.id);
  if (!access.allowed) {
    return null;
  }

  return authSession;
}

export async function getValidatedSession(input: { headers: Headers }) {
  const requestedAudience = input.headers.get(AUTH_AUDIENCE_HEADER);

  if (isAuthAudience(requestedAudience)) {
    const session = await getValidatedSessionForAudience({
      audience: requestedAudience,
      headers: input.headers,
    });

    return session
      ? {
          audience: requestedAudience,
          session,
        }
      : null;
  }

  const matches = await Promise.all(
    AUTH_AUDIENCES.map(async (audience) => {
      const session = await getValidatedSessionForAudience({
        audience,
        headers: input.headers,
      });
      return session ? { audience, session } : null;
    }),
  );

  const resolved = matches.filter((value) => value !== null);
  return resolved.length === 1 ? resolved[0] : null;
}

export type { AuthAudience };
export { type ResourcePermissions } from "./permissions";
