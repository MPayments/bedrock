import type { AuthContext } from "@bedrock/security";

export function requireActorUserId(auth: AuthContext): string {
  const actor = auth.requireActor();
  if (!actor.ok) {
    throw new Error("Authenticated actor is required.");
  }

  return actor.value.subject.id;
}

export function readActorRole(auth: AuthContext): string | null {
  const actor = auth.actor();
  if (!actor) {
    return null;
  }

  const role = actor.claims.role;
  return typeof role === "string" ? role : null;
}
