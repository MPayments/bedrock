import { eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { opsApplications } from "../../../infra/drizzle/schema";
import type { ApplicationStatus } from "../../domain/application-status";
import type { Application } from "../../application/contracts/dto";
import type { ApplicationStore } from "../../application/ports/application.store";

export class DrizzleApplicationStore implements ApplicationStore {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<Application | null> {
    const [row] = await this.db
      .select()
      .from(opsApplications)
      .where(eq(opsApplications.id, id))
      .limit(1);
    return (row as Application) ?? null;
  }

  async create(input: {
    agentId: string | null;
    clientId: number;
    status: ApplicationStatus;
    requestedAmount?: string;
    requestedCurrency?: string;
  }): Promise<Application> {
    const [created] = await this.db
      .insert(opsApplications)
      .values({
        agentId: input.agentId,
        clientId: input.clientId,
        status: input.status,
        requestedAmount: input.requestedAmount,
        requestedCurrency: input.requestedCurrency,
      })
      .returning();
    return created! as Application;
  }

  async updateStatus(
    id: number,
    status: ApplicationStatus,
    reason?: string,
  ): Promise<Application | null> {
    const [updated] = await this.db
      .update(opsApplications)
      .set({
        status,
        reason: reason ?? null,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(opsApplications.id, id))
      .returning();
    return (updated as Application) ?? null;
  }

  async updateComment(
    id: number,
    comment: string,
  ): Promise<Application | null> {
    const [updated] = await this.db
      .update(opsApplications)
      .set({ comment, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(opsApplications.id, id))
      .returning();
    return (updated as Application) ?? null;
  }

  async assignAgent(
    id: number,
    agentId: string,
  ): Promise<Application | null> {
    const [updated] = await this.db
      .update(opsApplications)
      .set({
        agentId,
        status: "created",
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(opsApplications.id, id))
      .returning();
    return (updated as Application) ?? null;
  }

  async remove(id: number): Promise<boolean> {
    const [deleted] = await this.db
      .delete(opsApplications)
      .where(eq(opsApplications.id, id))
      .returning({ id: opsApplications.id });
    return Boolean(deleted);
  }
}
