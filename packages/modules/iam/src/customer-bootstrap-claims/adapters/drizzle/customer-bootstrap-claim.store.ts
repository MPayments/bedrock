import { and, eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import type { CustomerBootstrapClaim } from "../../contracts/dto";
import { customerBootstrapClaims } from "./schema";

type ClaimKey = {
  normalizedInn: string;
  normalizedKpp: string;
  userId: string;
};

export class DrizzleCustomerBootstrapClaimStore {
  constructor(private readonly db: Queryable) {}

  async lockByKey(input: ClaimKey): Promise<CustomerBootstrapClaim> {
    await this.db
      .insert(customerBootstrapClaims)
      .values({
        normalizedInn: input.normalizedInn,
        normalizedKpp: input.normalizedKpp,
        userId: input.userId,
      })
      .onConflictDoNothing();

    const result = await this.db.execute(sql`
      SELECT
        id,
        user_id,
        normalized_inn,
        normalized_kpp,
        client_id,
        customer_id,
        status,
        created_at,
        updated_at
      FROM ${customerBootstrapClaims}
      WHERE user_id = ${input.userId}
        AND normalized_inn = ${input.normalizedInn}
        AND normalized_kpp = ${input.normalizedKpp}
      FOR UPDATE
    `);

    const [row] = (result.rows ?? []) as Array<{
      id: string;
      user_id: string;
      normalized_inn: string;
      normalized_kpp: string;
      client_id: number | null;
      customer_id: string | null;
      status: string;
      created_at: Date;
      updated_at: Date;
    }>;

    if (!row) {
      throw new Error("Failed to lock customer bootstrap claim");
    }

    return {
      id: row.id,
      userId: row.user_id,
      normalizedInn: row.normalized_inn,
      normalizedKpp: row.normalized_kpp,
      clientId: row.client_id,
      customerId: row.customer_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async complete(input: {
    clientId: number;
    customerId: string;
    id: string;
  }): Promise<CustomerBootstrapClaim> {
    const [claim] = await this.db
      .update(customerBootstrapClaims)
      .set({
        clientId: input.clientId,
        customerId: input.customerId,
        status: "completed",
        updatedAt: sql`now()`,
      })
      .where(eq(customerBootstrapClaims.id, input.id))
      .returning();

    if (!claim) {
      throw new Error(`Bootstrap claim not found: ${input.id}`);
    }

    return claim;
  }

  async findByKey(input: ClaimKey): Promise<CustomerBootstrapClaim | null> {
    const [claim] = await this.db
      .select()
      .from(customerBootstrapClaims)
      .where(
        and(
          eq(customerBootstrapClaims.userId, input.userId),
          eq(customerBootstrapClaims.normalizedInn, input.normalizedInn),
          eq(customerBootstrapClaims.normalizedKpp, input.normalizedKpp),
        ),
      )
      .limit(1);

    return claim ?? null;
  }
}
