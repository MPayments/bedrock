import {
  AUTH_AUDIENCE_HEADER,
  AUTH_AUDIENCES,
  createIamHttpEdge,
  type AuthSession,
} from "@bedrock/iam/adapters/http";
import type { AuthAudience } from "@bedrock/iam/contracts";

import { db } from "../db/client";
import { ctx, env } from "../runtime";

function parseOrigins(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return origins.length > 0 ? origins : undefined;
}

const httpEdge = createIamHttpEdge({
  auth: {
    audiences: {
      crm: {
        baseUrl: env.BETTER_AUTH_CRM_URL,
        trustedOrigins: parseOrigins(env.BETTER_AUTH_CRM_TRUSTED_ORIGINS),
      },
      finance: {
        baseUrl: env.BETTER_AUTH_FINANCE_URL,
        trustedOrigins: parseOrigins(env.BETTER_AUTH_FINANCE_TRUSTED_ORIGINS),
      },
      portal: {
        baseUrl: env.BETTER_AUTH_PORTAL_URL,
        trustedOrigins: parseOrigins(env.BETTER_AUTH_PORTAL_TRUSTED_ORIGINS),
      },
    },
    baseUrl: env.BETTER_AUTH_URL,
    nodeEnv: process.env.NODE_ENV,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: parseOrigins(env.BETTER_AUTH_TRUSTED_ORIGINS),
  },
  db,
  getPortalProfile: ({ userId }) => ctx.portalService.getProfile({ userId }),
  iamService: ctx.iamService,
});

export const authByAudience = httpEdge.authByAudience;

export const buildSessionSnapshotForAudience =
  httpEdge.buildSessionSnapshotForAudience;

export const getValidatedSession: (input: {
  headers: Headers;
}) => Promise<{
  audience: AuthAudience;
  session: NonNullable<AuthSession>;
} | null> = httpEdge.getValidatedSession;

export const getValidatedSessionForAudience: (input: {
  audience: AuthAudience;
  headers: Headers;
}) => Promise<AuthSession> = httpEdge.getValidatedSessionForAudience;

export type AppAuth = (typeof authByAudience)[AuthAudience];

export type { AuthAudience, AuthSession };
export { AUTH_AUDIENCE_HEADER, AUTH_AUDIENCES };
export { type ResourcePermissions } from "@bedrock/iam";
