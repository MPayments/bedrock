import { eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { opsSubAgents } from "../../../infra/drizzle/schema";
import type {
  CreateSubAgentInput,
  UpdateSubAgentInput,
} from "../../application/contracts/sub-agent-commands";
import type { SubAgent } from "../../application/contracts/sub-agent-dto";
import type { SubAgentStore } from "../../application/ports/sub-agent.store";

export class DrizzleSubAgentStore implements SubAgentStore {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<SubAgent | null> {
    const [row] = await this.db
      .select()
      .from(opsSubAgents)
      .where(eq(opsSubAgents.id, id))
      .limit(1);
    return (row as SubAgent) ?? null;
  }

  async create(input: CreateSubAgentInput): Promise<SubAgent> {
    const [created] = await this.db
      .insert(opsSubAgents)
      .values({
        name: input.name,
        commission: input.commission,
      })
      .returning();
    return created! as SubAgent;
  }

  async update(input: UpdateSubAgentInput): Promise<SubAgent | null> {
    const values: Record<string, unknown> = {};
    if (input.name !== undefined) values.name = input.name;
    if (input.commission !== undefined) values.commission = input.commission;

    const [updated] = await this.db
      .update(opsSubAgents)
      .set(values)
      .where(eq(opsSubAgents.id, input.id))
      .returning();
    return (updated as SubAgent) ?? null;
  }

  async remove(id: number): Promise<boolean> {
    const [deleted] = await this.db
      .delete(opsSubAgents)
      .where(eq(opsSubAgents.id, id))
      .returning({ id: opsSubAgents.id });
    return Boolean(deleted);
  }
}
