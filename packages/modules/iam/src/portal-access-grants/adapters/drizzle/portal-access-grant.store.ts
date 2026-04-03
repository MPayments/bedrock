import { eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { portalAccessGrants } from "./schema";
import type { PortalAccessGrant } from "../../application/contracts/dto";
import type { PortalAccessGrantStore } from "../../application/ports/portal-access-grant.store";

export class DrizzlePortalAccessGrantStore implements PortalAccessGrantStore {
  constructor(private readonly db: Queryable) {}

  async upsert(input: {
    status: string;
    userId: string;
  }): Promise<PortalAccessGrant> {
    const now = new Date();
    const [row] = await this.db
      .insert(portalAccessGrants)
      .values({
        status: input.status,
        updatedAt: now,
        userId: input.userId,
      })
      .onConflictDoUpdate({
        target: portalAccessGrants.userId,
        set: {
          status: input.status,
          updatedAt: now,
        },
      })
      .returning();

    return row as PortalAccessGrant;
  }

  async consumeByUserId(userId: string): Promise<PortalAccessGrant | null> {
    const [row] = await this.db
      .update(portalAccessGrants)
      .set({
        status: "consumed",
        updatedAt: new Date(),
      })
      .where(eq(portalAccessGrants.userId, userId))
      .returning();

    return (row as PortalAccessGrant | undefined) ?? null;
  }

  async revokeByUserId(userId: string): Promise<PortalAccessGrant | null> {
    const [row] = await this.db
      .update(portalAccessGrants)
      .set({
        status: "revoked",
        updatedAt: new Date(),
      })
      .where(eq(portalAccessGrants.userId, userId))
      .returning();

    return (row as PortalAccessGrant | undefined) ?? null;
  }
}
