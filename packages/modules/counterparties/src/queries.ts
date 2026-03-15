import { inArray, sql } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { schema } from "./schema";

export interface CounterpartiesQueries {
  listShortNamesById: (ids: string[]) => Promise<Map<string, string>>;
  listGroupMembers: (input: {
    groupIds: string[];
    includeDescendants: boolean;
  }) => Promise<
    {
      rootGroupId: string;
      counterpartyId: string;
    }[]
  >;
}

export function createCounterpartiesQueries(input: {
  db: Queryable;
}): CounterpartiesQueries {
  const { db } = input;

  return {
    async listShortNamesById(ids: string[]) {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (uniqueIds.length === 0) {
        return new Map();
      }

      const rows = await db
        .select({
          id: schema.counterparties.id,
          shortName: schema.counterparties.shortName,
        })
        .from(schema.counterparties)
        .where(inArray(schema.counterparties.id, uniqueIds));

      return new Map(rows.map((row) => [row.id, row.shortName]));
    },
    async listGroupMembers({ groupIds, includeDescendants }) {
      const uniqueGroupIds = Array.from(new Set(groupIds.filter(Boolean)));
      if (uniqueGroupIds.length === 0) {
        return [];
      }

      const groupIdsSql = sql.join(
        uniqueGroupIds.map((id) => sql`${id}`),
        sql`, `,
      );

      if (!includeDescendants) {
        const result = await db.execute(sql`
          WITH selected_groups AS (
            SELECT g.id AS root_group_id
            FROM ${schema.counterpartyGroups} g
            WHERE g.id IN (${groupIdsSql})
          )
          SELECT DISTINCT
            sg.root_group_id,
            m.counterparty_id
          FROM selected_groups sg
          INNER JOIN ${schema.counterpartyGroupMemberships} m
            ON m.group_id = sg.root_group_id
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

      const result = await db.execute(sql`
        WITH RECURSIVE selected_groups AS (
          SELECT g.id AS root_group_id, g.id AS group_id
          FROM ${schema.counterpartyGroups} g
          WHERE g.id IN (${groupIdsSql})
        ),
        group_tree AS (
          SELECT root_group_id, group_id
          FROM selected_groups
          UNION ALL
          SELECT gt.root_group_id, child.id
          FROM group_tree gt
          INNER JOIN ${schema.counterpartyGroups} child
            ON child.parent_id = gt.group_id
        )
        SELECT DISTINCT
          gt.root_group_id,
          m.counterparty_id
        FROM group_tree gt
        INNER JOIN ${schema.counterpartyGroupMemberships} m
          ON m.group_id = gt.group_id
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
    },
  };
}
