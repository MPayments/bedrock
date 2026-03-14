import { sql } from "drizzle-orm";

import type {
  LedgerOperationDetails,
  LedgerReadQueries,
} from "./queries/read";
import type { Database, Transaction } from "@bedrock/platform/persistence";

import { createLedgerReadService } from "./read-service";

type Queryable = Database | Transaction;

export interface AccountingScopedPostingRow {
  operationId: string;
  lineNo: number;
  postingDate: Date;
  status: "pending" | "posted" | "failed";
  bookId: string;
  bookLabel: string | null;
  bookCounterpartyId: string | null;
  currency: string;
  amountMinor: string;
  postingCode: string;
  debitAccountNo: string;
  creditAccountNo: string;
  analyticCounterpartyId: string | null;
  documentId: string | null;
  documentType: string | null;
  channel: string | null;
}

export interface LedgerBookRow {
  id: string;
  name: string | null;
  ownerId: string | null;
}

export interface LedgerQueries extends Pick<LedgerReadQueries, "getOperationDetails" | "listOperations"> {
  listBooksById: (ids: string[]) => Promise<LedgerBookRow[]>;
  listBooksByOwnerId: (ownerId: string) => Promise<LedgerBookRow[]>;
  listScopedPostingRows: (input: {
    statuses: Array<"pending" | "posted" | "failed">;
    from?: Date;
    to?: Date;
    asOf?: Date;
    currency?: string;
    resolvedBookIds: string[];
    resolvedCounterpartyIds: string[];
    scopeType: "all" | "counterparty" | "group" | "book";
    attributionMode: "analytic_counterparty" | "book_org";
    includeUnattributed: boolean;
    internalLedgerOrganizationIds: string[];
  }) => Promise<AccountingScopedPostingRow[]>;
}

export function createLedgerQueries(input: { db: Queryable }): LedgerQueries {
  const { db } = input;
  const readService = createLedgerReadService({ db });

  return {
    getOperationDetails: readService.getOperationDetails,
    listOperations: readService.listOperations,
    async listBooksById(ids: string[]) {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (uniqueIds.length === 0) {
        return [];
      }

      const result = await db.execute(sql`
        SELECT
          b.id::text AS id,
          b.name,
          b.owner_id::text AS owner_id
        FROM "books" b
        WHERE b.id IN (${sql.join(uniqueIds.map((id) => sql`${id}::uuid`), sql`, `)})
      `);

      return ((result.rows ?? []) as {
        id: string;
        name: string | null;
        owner_id: string | null;
      }[]).map((row) => ({
        id: row.id,
        name: row.name,
        ownerId: row.owner_id,
      }));
    },
    async listBooksByOwnerId(ownerId: string) {
      const result = await db.execute(sql`
        SELECT
          b.id::text AS id,
          b.name,
          b.owner_id::text AS owner_id
        FROM "books" b
        WHERE b.owner_id = ${ownerId}::uuid
      `);

      return ((result.rows ?? []) as {
        id: string;
        name: string | null;
        owner_id: string | null;
      }[]).map((row) => ({
        id: row.id,
        name: row.name,
        ownerId: row.owner_id,
      }));
    },
    async listScopedPostingRows(query) {
      if (
        (query.scopeType === "counterparty" || query.scopeType === "group") &&
        query.resolvedCounterpartyIds.length === 0
      ) {
        return [];
      }

      if (query.scopeType === "book" && query.resolvedBookIds.length === 0) {
        return [];
      }

      const analyticAttributionSql = sql`CASE
        WHEN debit_inst.dimensions->>'counterpartyId' IS NOT NULL
         AND credit_inst.dimensions->>'counterpartyId' IS NOT NULL
         AND debit_inst.dimensions->>'counterpartyId' <> credit_inst.dimensions->>'counterpartyId'
          THEN NULL
        ELSE COALESCE(
          debit_inst.dimensions->>'counterpartyId',
          credit_inst.dimensions->>'counterpartyId'
        )
      END`;

      const conditions = [
        sql`lo.status IN (${sql.join(
          query.statuses.map((status) => sql`${status}`),
          sql`, `,
        )})`,
      ];

      if (query.from) {
        conditions.push(sql`lo.posting_date >= ${query.from}`);
      }

      if (query.to) {
        conditions.push(sql`lo.posting_date <= ${query.to}`);
      }

      if (query.asOf) {
        conditions.push(sql`lo.posting_date <= ${query.asOf}`);
      }

      if (query.currency) {
        conditions.push(sql`p.currency = ${query.currency}`);
      }

      if (query.scopeType === "book") {
        conditions.push(
          sql`p.book_id IN (${sql.join(
            query.resolvedBookIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );
      } else if (
        query.scopeType === "counterparty" ||
        query.scopeType === "group"
      ) {
        if (query.attributionMode === "analytic_counterparty") {
          conditions.push(
            sql`${analyticAttributionSql} IN (${sql.join(
              query.resolvedCounterpartyIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          );
        } else {
          const bookScopedOrganizationIds = query.resolvedCounterpartyIds.filter((id) =>
            query.internalLedgerOrganizationIds.includes(id),
          );
          if (bookScopedOrganizationIds.length === 0) {
            return [];
          }

          conditions.push(
            sql`b.owner_id IN (${sql.join(
              bookScopedOrganizationIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          );
        }
      }

      if (query.attributionMode === "book_org") {
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

      if (query.attributionMode === "analytic_counterparty" && !query.includeUnattributed) {
        conditions.push(sql`${analyticAttributionSql} IS NOT NULL`);
      }

      const whereSql =
        conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`true`;

      const result = await db.execute(sql`
        SELECT
          p.operation_id,
          p.line_no,
          lo.posting_date,
          lo.status,
          p.book_id,
          b.name AS book_name,
          b.owner_id::text AS book_counterparty_id,
          p.currency,
          p.amount_minor::text AS amount_minor,
          p.posting_code,
          debit_inst.account_no AS debit_account_no,
          credit_inst.account_no AS credit_account_no,
          ${analyticAttributionSql} AS analytic_counterparty_id,
          d.id::text AS document_id,
          d.doc_type AS document_type,
          COALESCE(d.payload->>'channel', lo.source_type) AS channel
        FROM "postings" p
        INNER JOIN "ledger_operations" lo
          ON lo.id = p.operation_id
        INNER JOIN "book_account_instances" debit_inst
          ON debit_inst.id = p.debit_instance_id
        INNER JOIN "book_account_instances" credit_inst
          ON credit_inst.id = p.credit_instance_id
        LEFT JOIN "books" b
          ON b.id = p.book_id
        LEFT JOIN "document_operations" dop
          ON dop.operation_id = lo.id
        LEFT JOIN "documents" d
          ON d.id = dop.document_id
        WHERE ${whereSql}
        ORDER BY lo.posting_date, p.operation_id, p.line_no
      `);

      return ((result.rows ?? []) as {
        operation_id: string;
        line_no: number;
        posting_date: Date;
        status: "pending" | "posted" | "failed";
        book_id: string;
        book_name: string | null;
        book_counterparty_id: string | null;
        currency: string;
        amount_minor: string;
        posting_code: string;
        debit_account_no: string;
        credit_account_no: string;
        analytic_counterparty_id: string | null;
        document_id: string | null;
        document_type: string | null;
        channel: string | null;
      }[]).map((row) => ({
        operationId: row.operation_id,
        lineNo: row.line_no,
        postingDate: new Date(row.posting_date),
        status: row.status,
        bookId: row.book_id,
        bookLabel: row.book_name,
        bookCounterpartyId: row.book_counterparty_id,
        currency: row.currency,
        amountMinor: row.amount_minor,
        postingCode: row.posting_code,
        debitAccountNo: row.debit_account_no,
        creditAccountNo: row.credit_account_no,
        analyticCounterpartyId: row.analytic_counterparty_id,
        documentId: row.document_id,
        documentType: row.document_type,
        channel: row.channel,
      }));
    },
  };
}

export type { LedgerOperationDetails };
