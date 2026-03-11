import { betterAuth, type Auth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  admin as adminPlugin,
  openAPI as openApiPlugin,
  twoFactor,
} from "better-auth/plugins";
import type { Actor } from "@bedrock/security";

import { ac, admin, resolvePermissionsForRole, user } from "./permissions";

type BetterAuthUserLike = {
  id?: unknown;
  role?: unknown;
  email?: unknown;
  emailVerified?: unknown;
  name?: unknown;
  image?: unknown;
};

type BetterAuthSessionLike = {
  id?: unknown;
};

export function createMultihansaBetterAuth(input: {
  db: unknown;
  secret: string;
  url: string;
  trustedOrigins: readonly string[];
}): Auth<any> {
  return betterAuth({
    appName: "Multihansa Finance",
    secret: input.secret,
    baseURL: input.url,
    basePath: "/api/auth",
    trustedOrigins: [...input.trustedOrigins],
    trustedHeaders: ["cookie"],
    advanced: {
      crossSubDomainCookies: {
        enabled: true,
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    database: drizzleAdapter(input.db as never, {
      provider: "pg",
    }),
    plugins: [
      openApiPlugin(),
      adminPlugin({
        ac,
        roles: {
          admin,
          user,
        },
      }),
      twoFactor({
        issuer: "Multihansa Finance",
        skipVerificationOnEnable: false,
      }),
    ],
  });
}

export function createMultihansaActor(input: {
  user: BetterAuthUserLike | null;
  session: BetterAuthSessionLike | null;
}): Actor | null {
  const userId = typeof input.user?.id === "string" ? input.user.id : null;
  if (!userId) {
    return null;
  }

  const role = input.user?.role === "admin" ? "admin" : "user";

  return {
    kind: "user",
    subject: {
      id: userId,
    },
    sessionId: typeof input.session?.id === "string" ? input.session.id : undefined,
    roles: [{ role }],
    permissions: resolvePermissionsForRole(role),
    claims: Object.freeze({
      role,
      ...(typeof input.user?.email === "string" ? { email: input.user.email } : {}),
      ...(typeof input.user?.emailVerified === "boolean"
        ? { emailVerified: input.user.emailVerified }
        : {}),
      ...(typeof input.user?.name === "string" ? { name: input.user.name } : {}),
      ...(typeof input.user?.image === "string" ? { image: input.user.image } : {}),
    }),
  };
}
