import { error, token, type Result } from "@bedrock/core";

import type { AccessScopeRef, Actor, ActorClaims } from "./actor";
import {
  SecurityForbidden,
  SecurityUnauthenticated,
  type SecurityAccessError,
  type SecurityForbiddenError,
  type SecurityUnauthenticatedError,
} from "./errors";
import {
  createPolicyDeny,
  type InferPolicyError,
  type PolicyDescriptor,
} from "./policy";

export type AuthContext = {
  actor(): Actor | null;
  requireActor(): Result<Actor, SecurityUnauthenticatedError>;
  hasRole(role: string, scope?: AccessScopeRef): boolean;
  hasPermission(permission: string, scope?: AccessScopeRef): boolean;
  check<TPolicy extends PolicyDescriptor<AuthContext, any, any>>(
    policy: TPolicy,
    input: Parameters<TPolicy["check"]>[0]["input"],
  ): Promise<Result<void, InferPolicyError<TPolicy>>>;
  requireRole(
    role: string,
    scope?: AccessScopeRef,
  ): Result<Actor, SecurityAccessError>;
  requirePermission(
    permission: string,
    scope?: AccessScopeRef,
  ): Result<Actor, SecurityAccessError>;
};

export const OptionalActorToken = token<Actor | null>(
  "bedrock.security.optional-actor",
);

export const AuthContextToken = token<AuthContext>(
  "bedrock.security.auth-context",
);

export function createAuthContext(actor: Actor | null): AuthContext {
  const authContext: AuthContext = {
    actor: () => actor,

    requireActor: () => {
      if (actor && actor.kind !== "anonymous") {
        return {
          ok: true as const,
          value: actor,
        };
      }

      return securityUnauthenticated();
    },

    hasRole: (role, scope) => {
      if (!actor || actor.kind === "anonymous") {
        return false;
      }

      return actor.roles.some(
        (grant) => grant.role === role && matchesScope(grant.scope, scope),
      );
    },

    hasPermission: (permission, scope) => {
      if (!actor || actor.kind === "anonymous") {
        return false;
      }

      return actor.permissions.some(
        (grant) =>
          grant.permission === permission && matchesScope(grant.scope, scope),
      );
    },

    check: async (policy, input) =>
      policy.check({
        ctx: authContext,
        input,
        deny: createPolicyDeny<any>(),
      }) as Promise<Result<void, InferPolicyError<typeof policy>>>,

    requireRole: (role, scope) => {
      const currentActor = authContext.requireActor();
      if (!currentActor.ok) {
        return currentActor;
      }

      if (authContext.hasRole(role, scope)) {
        return currentActor;
      }

      return securityForbidden({
        kind: "role",
        role,
        scope,
      });
    },

    requirePermission: (permission, scope) => {
      const currentActor = authContext.requireActor();
      if (!currentActor.ok) {
        return currentActor;
      }

      if (authContext.hasPermission(permission, scope)) {
        return currentActor;
      }

      return securityForbidden({
        kind: "permission",
        permission,
        scope,
      });
    },
  };

  return Object.freeze(authContext);
}

export function mergeActorClaims(
  baseClaims: Readonly<Record<string, ActorClaims>>,
  nextClaims?: Readonly<Record<string, ActorClaims>>,
): Readonly<Record<string, ActorClaims>> {
  if (!nextClaims || Object.keys(nextClaims).length === 0) {
    return baseClaims;
  }

  return Object.freeze({
    ...baseClaims,
    ...nextClaims,
  });
}

function matchesScope(
  grantScope: AccessScopeRef | undefined,
  requiredScope: AccessScopeRef | undefined,
): boolean {
  if (!requiredScope) {
    return true;
  }

  if (!grantScope) {
    return true;
  }

  return (
    grantScope.type === requiredScope.type && grantScope.id === requiredScope.id
  );
}

function securityUnauthenticated(): Result<never, SecurityUnauthenticatedError> {
  return {
    ok: false,
    error: error(SecurityUnauthenticated).error,
  } as Result<never, SecurityUnauthenticatedError>;
}

function securityForbidden(args: {
  kind: "role" | "permission" | "policy";
  role?: string;
  permission?: string;
  policy?: string;
  scope?: AccessScopeRef;
}): Result<never, SecurityForbiddenError> {
  return {
    ok: false,
    error: error(SecurityForbidden, args).error,
  } as Result<never, SecurityForbiddenError>;
}
