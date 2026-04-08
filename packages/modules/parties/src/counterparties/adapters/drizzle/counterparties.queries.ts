import {
  and,
  eq,
  ilike,
  inArray,
  isNotNull,
  like,
  or,
  sql,
} from "drizzle-orm";

import type { Database } from "@bedrock/platform/persistence";
import { dedupeStrings as dedupeIds } from "@bedrock/shared/core/domain";

import {
  partyIdentifiers,
  partyProfiles,
} from "../../../party-profiles/adapters/drizzle/schema";
import {
  counterpartyGroupMemberships,
  counterpartyGroups,
  customerCounterpartyAssignments,
  counterparties,
} from "./schema";

export class DrizzleCounterpartiesQueries {
  constructor(private readonly db: Database) {}

  async searchCustomerOwnedCounterparties(input: {
    limit: number;
    offset: number;
    q: string;
  }): Promise<
    {
      counterpartyId: string;
      customerId: string | null;
      inn: string | null;
      orgName: string;
      shortName: string;
    }[]
  > {
    return this.db
      .select({
        counterpartyId: counterparties.id,
        customerId: counterparties.customerId,
        inn: partyIdentifiers.value,
        orgName: counterparties.fullName,
        shortName: counterparties.shortName,
      })
      .from(counterparties)
      .leftJoin(
        partyProfiles,
        eq(partyProfiles.counterpartyId, counterparties.id),
      )
      .leftJoin(
        partyIdentifiers,
        and(
          eq(partyIdentifiers.partyProfileId, partyProfiles.id),
          eq(partyIdentifiers.scheme, "inn"),
        ),
      )
      .where(
        and(
          eq(counterparties.relationshipKind, "customer_owned"),
          isNotNull(counterparties.customerId),
          or(
            ilike(counterparties.shortName, `%${input.q}%`),
            ilike(counterparties.fullName, `%${input.q}%`),
            like(sql`coalesce(${partyIdentifiers.value}, '')`, `%${input.q}%`),
          ),
        ),
      )
      .limit(input.limit)
      .offset(input.offset);
  }

  async listAssignmentsByCounterpartyIds(counterpartyIds: string[]): Promise<
    Map<
      string,
      {
        counterpartyId: string;
        subAgentCounterpartyId: string | null;
      }
    >
  > {
    const uniqueIds = dedupeIds(counterpartyIds);
    if (uniqueIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        counterpartyId: customerCounterpartyAssignments.counterpartyId,
        subAgentCounterpartyId:
          customerCounterpartyAssignments.subAgentCounterpartyId,
      })
      .from(customerCounterpartyAssignments)
      .where(inArray(customerCounterpartyAssignments.counterpartyId, uniqueIds));

    return new Map(rows.map((row) => [row.counterpartyId, row] as const));
  }

  async listCustomerIdsByCustomerOwnedCounterpartySearch(input: {
    limit: number;
    q: string;
  }): Promise<string[]> {
    const rows = await this.db
      .select({
        customerId: counterparties.customerId,
      })
      .from(counterparties)
      .leftJoin(
        partyProfiles,
        eq(partyProfiles.counterpartyId, counterparties.id),
      )
      .leftJoin(
        partyIdentifiers,
        eq(partyIdentifiers.partyProfileId, partyProfiles.id),
      )
      .where(
        and(
          eq(counterparties.relationshipKind, "customer_owned"),
          isNotNull(counterparties.customerId),
          or(
            ilike(counterparties.shortName, `%${input.q}%`),
            ilike(counterparties.fullName, `%${input.q}%`),
            ilike(counterparties.externalRef, `%${input.q}%`),
            like(sql`coalesce(${partyIdentifiers.value}, '')`, `%${input.q}%`),
          ),
        ),
      )
      .limit(input.limit);

    return Array.from(
      new Set(
        rows
          .map((row) => row.customerId)
          .filter((customerId): customerId is string => Boolean(customerId)),
      ),
    );
  }

  async upsertAssignment(input: {
    counterpartyId: string;
    subAgentCounterpartyId: string | null;
  }): Promise<void> {
    await this.db
      .insert(customerCounterpartyAssignments)
      .values({
        counterpartyId: input.counterpartyId,
        subAgentCounterpartyId: input.subAgentCounterpartyId,
      })
      .onConflictDoUpdate({
        target: customerCounterpartyAssignments.counterpartyId,
        set: {
          subAgentCounterpartyId: input.subAgentCounterpartyId,
          updatedAt: new Date(),
        },
      });
  }

  async listShortNamesById(ids: string[]): Promise<Map<string, string>> {
    const uniqueIds = dedupeIds(ids);
    if (uniqueIds.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        id: counterparties.id,
        shortName: counterparties.shortName,
      })
      .from(counterparties)
      .where(inArray(counterparties.id, uniqueIds));

    return new Map(rows.map((row) => [row.id, row.shortName]));
  }

  async listGroupMembers(input: {
    groupIds: string[];
    includeDescendants: boolean;
  }): Promise<
    {
      rootGroupId: string;
      counterpartyId: string;
    }[]
  > {
    const uniqueGroupIds = dedupeIds(input.groupIds);
    if (uniqueGroupIds.length === 0) {
      return [];
    }

    const groupIdsSql = sql.join(
      uniqueGroupIds.map((id: string) => sql`${id}`),
      sql`, `,
    );

    if (!input.includeDescendants) {
      const result = await this.db.execute(sql`
        WITH selected_groups AS (
          SELECT g.id AS root_group_id
          FROM ${counterpartyGroups} g
          WHERE g.id IN (${groupIdsSql})
        )
        SELECT DISTINCT
          sg.root_group_id,
          m.counterparty_id
        FROM selected_groups sg
        INNER JOIN ${counterpartyGroupMemberships} m
          ON m.group_id = sg.root_group_id
        ORDER BY sg.root_group_id, m.counterparty_id
      `);

      return (
        (result.rows ?? []) as {
          root_group_id: string;
          counterparty_id: string;
        }[]
      ).map((row) => ({
        rootGroupId: row.root_group_id,
        counterpartyId: row.counterparty_id,
      }));
    }

    const result = await this.db.execute(sql`
      WITH RECURSIVE selected_groups AS (
        SELECT g.id AS root_group_id, g.id AS group_id
        FROM ${counterpartyGroups} g
        WHERE g.id IN (${groupIdsSql})
      ),
      group_tree AS (
        SELECT root_group_id, group_id
        FROM selected_groups
        UNION ALL
        SELECT gt.root_group_id, child.id
        FROM group_tree gt
        INNER JOIN ${counterpartyGroups} child
          ON child.parent_id = gt.group_id
      )
      SELECT DISTINCT
        gt.root_group_id,
        m.counterparty_id
      FROM group_tree gt
      INNER JOIN ${counterpartyGroupMemberships} m
        ON m.group_id = gt.group_id
      ORDER BY gt.root_group_id, m.counterparty_id
    `);

    return (
      (result.rows ?? []) as {
        root_group_id: string;
        counterparty_id: string;
      }[]
    ).map((row) => ({
      rootGroupId: row.root_group_id,
      counterpartyId: row.counterparty_id,
    }));
  }
}
