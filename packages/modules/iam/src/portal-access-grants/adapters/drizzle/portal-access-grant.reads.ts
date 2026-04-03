import { and, eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { portalAccessGrants } from "./schema";
import type { PortalAccessGrant } from "../../application/contracts/dto";
import type { PortalAccessGrantReads } from "../../application/ports/portal-access-grant.reads";

export class DrizzlePortalAccessGrantReads implements PortalAccessGrantReads {
  constructor(private readonly db: Queryable) {}

  async findByUserId(userId: string): Promise<PortalAccessGrant | null> {
    const [row] = await this.db
      .select()
      .from(portalAccessGrants)
      .where(eq(portalAccessGrants.userId, userId))
      .limit(1);

    return (row as PortalAccessGrant | undefined) ?? null;
  }

  async hasPendingGrant(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: portalAccessGrants.id })
      .from(portalAccessGrants)
      .where(
        and(
          eq(portalAccessGrants.userId, userId),
          eq(portalAccessGrants.status, "pending_onboarding"),
        ),
      )
      .limit(1);

    return Boolean(row);
  }
}
