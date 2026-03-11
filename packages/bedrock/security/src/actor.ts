export type ActorClaimScalar = string | number | boolean | null;

export type ActorClaims = ActorClaimScalar | readonly ActorClaimScalar[];

export type AccessScopeRef = Readonly<{
  type: string;
  id: string;
}>;

export type RoleGrant = Readonly<{
  role: string;
  scope?: AccessScopeRef;
}>;

export type PermissionGrant = Readonly<{
  permission: string;
  scope?: AccessScopeRef;
}>;

export type ApiKeyRef = Readonly<{
  id: string;
  ownerType: "user" | "organization";
  ownerId: string;
}>;

export type Actor = Readonly<{
  kind: "anonymous" | "user" | "service" | "api-key";
  subject: Readonly<{
    id: string;
  }>;
  sessionId?: string;
  activeScope?: AccessScopeRef;
  roles: readonly RoleGrant[];
  permissions: readonly PermissionGrant[];
  claims: Readonly<Record<string, ActorClaims>>;
  apiKey?: ApiKeyRef;
}>;
