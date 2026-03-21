import { asc, eq, inArray, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { counterpartyGroupMemberships, counterparties } from "./schema";
import type { CounterpartyRepository } from "../../application/ports/counterparty.repository";
import { Counterparty, type CounterpartySnapshot } from "../../domain/counterparty";

function dedupeIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids));
}

type CounterpartyRecord = Omit<CounterpartySnapshot, "groupIds">;

export class DrizzleCounterpartyRepository implements CounterpartyRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string): Promise<Counterparty | null> {
    const [row] = await this.db
      .select()
      .from(counterparties)
      .where(eq(counterparties.id, id))
      .limit(1);

    if (!row) {
      return null;
    }

    return (await this.hydrateRows([row]))[0] ?? null;
  }

  async findByCustomerId(customerId: string): Promise<Counterparty[]> {
    const rows = await this.db
      .select()
      .from(counterparties)
      .where(eq(counterparties.customerId, customerId))
      .orderBy(asc(counterparties.createdAt), asc(counterparties.id));

    return this.hydrateRows(rows);
  }

  async save(counterparty: Counterparty): Promise<Counterparty> {
    const snapshot = counterparty.toSnapshot();
    const existing = await this.findExistingRow(snapshot.id);
    const row = existing
      ? await this.updateRow(snapshot)
      : await this.insertRow(snapshot);

    await this.replaceMemberships(snapshot.id, snapshot.groupIds);

    return Counterparty.fromSnapshot({
      ...row,
      groupIds: [...snapshot.groupIds],
    });
  }

  async remove(id: string): Promise<boolean> {
    const [deleted] = await this.db
      .delete(counterparties)
      .where(eq(counterparties.id, id))
      .returning({ id: counterparties.id });

    return Boolean(deleted);
  }

  private async findExistingRow(id: string) {
    const [row] = await this.db
      .select({ id: counterparties.id })
      .from(counterparties)
      .where(eq(counterparties.id, id))
      .limit(1);

    return row ?? null;
  }

  private async insertRow(counterparty: CounterpartySnapshot) {
    const [created] = await this.db
      .insert(counterparties)
      .values({
        id: counterparty.id,
        externalId: counterparty.externalId,
        customerId: counterparty.customerId,
        shortName: counterparty.shortName,
        fullName: counterparty.fullName,
        description: counterparty.description,
        country: counterparty.country,
        kind: counterparty.kind,
      })
      .returning();

    return created!;
  }

  private async updateRow(counterparty: CounterpartySnapshot) {
    const [updated] = await this.db
      .update(counterparties)
      .set({
        externalId: counterparty.externalId,
        customerId: counterparty.customerId,
        shortName: counterparty.shortName,
        fullName: counterparty.fullName,
        description: counterparty.description,
        country: counterparty.country,
        kind: counterparty.kind,
        updatedAt: sql`now()`,
      })
      .where(eq(counterparties.id, counterparty.id))
      .returning();

    return updated!;
  }

  private async hydrateRows(rows: CounterpartyRecord[]): Promise<Counterparty[]> {
    const membershipsByCounterpartyId =
      await this.readMembershipIdsByCounterpartyIds(rows.map((row) => row.id));

    return rows.map((row) =>
      Counterparty.fromSnapshot({
        ...row,
        groupIds: membershipsByCounterpartyId.get(row.id) ?? [],
      }),
    );
  }

  private async readMembershipIdsByCounterpartyIds(
    counterpartyIds: readonly string[],
  ): Promise<Map<string, string[]>> {
    const uniqueIds = dedupeIds(counterpartyIds);
    if (uniqueIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        counterpartyId: counterpartyGroupMemberships.counterpartyId,
        groupId: counterpartyGroupMemberships.groupId,
      })
      .from(counterpartyGroupMemberships)
      .where(inArray(counterpartyGroupMemberships.counterpartyId, uniqueIds))
      .orderBy(
        asc(counterpartyGroupMemberships.counterpartyId),
        asc(counterpartyGroupMemberships.createdAt),
        asc(counterpartyGroupMemberships.groupId),
      );

    const membershipsByCounterpartyId = new Map<string, string[]>();

    for (const row of rows) {
      const memberships =
        membershipsByCounterpartyId.get(row.counterpartyId) ?? [];
      memberships.push(row.groupId);
      membershipsByCounterpartyId.set(row.counterpartyId, memberships);
    }

    return membershipsByCounterpartyId;
  }

  private async replaceMemberships(
    counterpartyId: string,
    groupIds: string[],
  ): Promise<void> {
    const uniqueGroupIds = dedupeIds(groupIds);

    await this.db
      .delete(counterpartyGroupMemberships)
      .where(eq(counterpartyGroupMemberships.counterpartyId, counterpartyId));

    if (uniqueGroupIds.length === 0) {
      return;
    }

    await this.db.insert(counterpartyGroupMemberships).values(
      uniqueGroupIds.map((groupId: string) => ({
        counterpartyId,
        groupId,
      })),
    );
  }
}
