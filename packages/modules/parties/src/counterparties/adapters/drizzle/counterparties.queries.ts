import { inArray, sql } from "drizzle-orm";

import type { Database } from "@bedrock/platform/persistence";

import {
  counterpartyGroupMemberships,
  counterpartyGroups,
  counterparties,
} from "./schema";

function dedupeIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids));
}

export class DrizzleCounterpartiesQueries {
  constructor(private readonly db: Database) {}

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
