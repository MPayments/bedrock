import { and, asc, eq, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { counterpartyGroups } from "./schema";
import {
  buildManagedCustomerGroupCode,
  isManagedCustomerGroupCode,
} from "../../../shared/domain/managed-customer-group";
import type { CounterpartyGroupRepository } from "../../application/ports/counterparty-group.repository";
import type { CounterpartyGroupSnapshot } from "../../domain/counterparty-group";
import { CounterpartyGroup } from "../../domain/counterparty-group";

export class DrizzleCounterpartyGroupRepository implements CounterpartyGroupRepository {
  constructor(private readonly db: Queryable) {}

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(counterpartyGroups)
      .where(eq(counterpartyGroups.id, id))
      .limit(1);

    if (!row) return null;

    return CounterpartyGroup.fromSnapshot(row);
  }

  async save(group: CounterpartyGroup) {
    const snapshot = group.toSnapshot();
    const existing = await this.findExistingGroup(snapshot);

    const row = existing
      ? await this.updateRow(existing.id, snapshot)
      : await this.insertRow(snapshot);

    return CounterpartyGroup.fromSnapshot(row);
  }

  async remove(id: string) {
    const [deleted] = await this.db
      .delete(counterpartyGroups)
      .where(eq(counterpartyGroups.id, id))
      .returning({ id: counterpartyGroups.id });

    return Boolean(deleted);
  }

  async findManagedCustomerGroup(customerId: string) {
    const [row] = await this.db
      .select()
      .from(counterpartyGroups)
      .where(
        and(
          eq(counterpartyGroups.customerId, customerId),
          eq(
            counterpartyGroups.code,
            buildManagedCustomerGroupCode(customerId),
          ),
        ),
      )
      .limit(1);

    if (!row) return null;

    return CounterpartyGroup.fromSnapshot(row);
  }

  async findByParentId(parentId: string) {
    const rows = await this.db
      .select()
      .from(counterpartyGroups)
      .where(eq(counterpartyGroups.parentId, parentId))
      .orderBy(asc(counterpartyGroups.createdAt), asc(counterpartyGroups.id));

    return rows.map((row) => CounterpartyGroup.fromSnapshot(row));
  }

  private async findExistingGroup(snapshot: CounterpartyGroupSnapshot) {
    const [existingById] = await this.db
      .select({ id: counterpartyGroups.id })
      .from(counterpartyGroups)
      .where(eq(counterpartyGroups.id, snapshot.id))
      .limit(1);

    if (existingById) {
      return existingById;
    }

    if (snapshot.customerId && isManagedCustomerGroupCode(snapshot.code)) {
      const existingManagedGroup = await this.findManagedCustomerGroup(
        snapshot.customerId,
      );

      return existingManagedGroup
        ? { id: existingManagedGroup.toSnapshot().id }
        : null;
    }

    return null;
  }

  private async insertRow(snapshot: CounterpartyGroupSnapshot) {
    const [created] = await this.db
      .insert(counterpartyGroups)
      .values({
        id: snapshot.id,
        code: snapshot.code,
        name: snapshot.name,
        description: snapshot.description,
        parentId: snapshot.parentId,
        customerId: snapshot.customerId,
        isSystem: snapshot.isSystem,
      })
      .returning();

    return created!;
  }

  private async updateRow(id: string, snapshot: CounterpartyGroupSnapshot) {
    const [updated] = await this.db
      .update(counterpartyGroups)
      .set({
        code: snapshot.code,
        name: snapshot.name,
        description: snapshot.description,
        parentId: snapshot.parentId,
        customerId: snapshot.customerId,
        updatedAt: sql`now()`,
      })
      .where(eq(counterpartyGroups.id, id))
      .returning();

    return updated!;
  }
}
