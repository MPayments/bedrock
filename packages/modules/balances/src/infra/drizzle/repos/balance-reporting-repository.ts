import { sql } from "drizzle-orm";

import type { Database } from "@bedrock/platform/persistence";

import type { BalancesReportingRepository } from "../../../application/reporting/ports";

export function createDrizzleBalancesReportingRepository(
  db: Database,
): BalancesReportingRepository {
  return {
    async listOrganizationLiquidityRows(query) {
      const conditions = [sql`bp.subject_type = 'organization_requisite'`];

      if (query.scopeType === "book") {
        if (query.resolvedBookIds.length === 0) {
          return [];
        }

        conditions.push(
          sql`bp.book_id IN (${sql.join(
            query.resolvedBookIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );
      }

      if (query.scopeType === "counterparty" || query.scopeType === "group") {
        if (query.attributionMode === "book_org") {
          const scopedOrganizationIds = query.resolvedCounterpartyIds.filter(
            (id) => query.internalLedgerOrganizationIds.includes(id),
          );

          if (scopedOrganizationIds.length === 0) {
            return [];
          }

          conditions.push(
            sql`b.owner_id IN (${sql.join(
              scopedOrganizationIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          );
        } else {
          conditions.push(
            sql`r.organization_id IN (${sql.join(
              query.resolvedCounterpartyIds.map((id) => sql`${id}`),
              sql`, `,
            )}) AND r.owner_type = 'organization'`,
          );
        }
      }

      if (query.scopeType === "all" && query.attributionMode === "book_org") {
        if (query.internalLedgerOrganizationIds.length === 0) {
          return [];
        }

        conditions.push(
          sql`b.owner_id IN (${sql.join(
            query.internalLedgerOrganizationIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );
      }

      if (query.currency) {
        conditions.push(sql`bp.currency = ${query.currency}`);
      }

      const whereSql =
        conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`true`;

      const result = await db.execute(sql`
        SELECT
          bp.book_id,
          r.organization_id::text AS counterparty_id,
          bp.currency,
          coalesce(sum(bp.ledger_balance), 0)::text AS ledger_balance_minor,
          coalesce(sum(bp.available), 0)::text AS available_minor,
          coalesce(sum(bp.reserved), 0)::text AS reserved_minor,
          coalesce(sum(bp.pending), 0)::text AS pending_minor
        FROM "balance_positions" bp
        LEFT JOIN "requisites" r
          ON r.id::text = bp.subject_id
         AND r.owner_type = 'organization'
        LEFT JOIN "books" b
          ON b.id = bp.book_id
        WHERE ${whereSql}
        GROUP BY
          bp.book_id,
          r.organization_id,
          bp.currency
      `);

      return (
        (result.rows ?? []) as {
          book_id: string;
          counterparty_id: string | null;
          currency: string;
          ledger_balance_minor: string;
          available_minor: string;
          reserved_minor: string;
          pending_minor: string;
        }[]
      ).map((row) => ({
        bookId: row.book_id,
        counterpartyId: row.counterparty_id,
        currency: row.currency,
        ledgerBalanceMinor: row.ledger_balance_minor,
        availableMinor: row.available_minor,
        reservedMinor: row.reserved_minor,
        pendingMinor: row.pending_minor,
      }));
    },
  };
}
