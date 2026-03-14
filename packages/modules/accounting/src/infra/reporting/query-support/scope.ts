import { inArray, sql, type SQL } from "drizzle-orm";

import { ValidationError } from "@bedrock/core/errors";
import type { Database, Transaction } from "@bedrock/platform-persistence";

import { toBigInt } from "../../../domain/reports/normalization";
import { listAccountingInternalOrganizations } from "../../organizations/internal-ledger";
import { schema } from "./shared";
import type {
  FinancialResultStatus,
  ReportScopeMeta,
  ResolvedScope,
  ScopedPosting,
} from "../../../domain/reports/types";
import type {
  ReportAttributionMode,
  ReportScopeType,
} from "../../../contracts/reporting";

type Queryable = Database | Transaction;
const DOCUMENT_OPERATIONS_TABLE = sql.raw('"document_operations"');
const DOCUMENTS_TABLE = sql.raw('"documents"');

export function createReportsScopeHelpers(db: Queryable) {
  async function listInternalLedgerOrganizationIds(): Promise<string[]> {
    const rows = await listAccountingInternalOrganizations(db);
    return rows.map((row) => row.id);
  }

  async function resolveGroupMemberRows(
    groupIds: string[],
    includeDescendants: boolean,
  ): Promise<{ rootGroupId: string; counterpartyId: string }[]> {
    if (groupIds.length === 0) {
      return [];
    }

    const uniqueGroupIds = Array.from(new Set(groupIds));
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

      return ((result.rows ?? []) as {
        root_group_id: string;
        counterparty_id: string;
      }[]).map((row) => ({
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

    return ((result.rows ?? []) as {
      root_group_id: string;
      counterparty_id: string;
    }[]).map((row) => ({
      rootGroupId: row.root_group_id,
      counterpartyId: row.counterparty_id,
    }));
  }

  async function resolveScope(input: {
    scopeType: ReportScopeType;
    counterpartyIds: string[];
    groupIds: string[];
    bookIds: string[];
    includeDescendants: boolean;
  }): Promise<ResolvedScope> {
    const requestedCounterpartyIds = Array.from(new Set(input.counterpartyIds));
    const requestedGroupIds = Array.from(new Set(input.groupIds));
    const requestedBookIds = Array.from(new Set(input.bookIds));

    if (input.scopeType === "all") {
      return {
        scopeType: input.scopeType,
        requestedCounterpartyIds,
        requestedGroupIds,
        requestedBookIds,
        resolvedCounterpartyIds: [],
        resolvedBookIds: [],
      };
    }

    if (input.scopeType === "counterparty") {
      return {
        scopeType: input.scopeType,
        requestedCounterpartyIds,
        requestedGroupIds,
        requestedBookIds,
        resolvedCounterpartyIds: requestedCounterpartyIds,
        resolvedBookIds: [],
      };
    }

    if (input.scopeType === "group") {
      const members = await resolveGroupMemberRows(
        requestedGroupIds,
        input.includeDescendants,
      );

      return {
        scopeType: input.scopeType,
        requestedCounterpartyIds,
        requestedGroupIds,
        requestedBookIds,
        resolvedCounterpartyIds: Array.from(
          new Set(members.map((row) => row.counterpartyId)),
        ),
        resolvedBookIds: [],
      };
    }

    const bookRows =
      requestedBookIds.length === 0
        ? []
        : await db
            .select({
              id: schema.books.id,
              organizationId: schema.books.ownerId,
            })
            .from(schema.books)
            .where(inArray(schema.books.id, requestedBookIds));

    const internalOrganizationIdSet = new Set(
      await listInternalLedgerOrganizationIds(),
    );
    const invalidBookIds = bookRows
      .filter(
        (row) =>
          !row.organizationId ||
          !internalOrganizationIdSet.has(row.organizationId),
      )
      .map((row) => row.id);
    if (invalidBookIds.length > 0) {
      throw new ValidationError(
        `book scope can include only internal-ledger books: ${invalidBookIds.join(", ")}`,
      );
    }

    return {
      scopeType: input.scopeType,
      requestedCounterpartyIds,
      requestedGroupIds,
      requestedBookIds,
      resolvedCounterpartyIds: Array.from(
        new Set(
          bookRows
            .map((row) => row.organizationId)
            .filter((id): id is string => Boolean(id)),
        ),
      ),
      resolvedBookIds: bookRows.map((row) => row.id),
    };
  }

  function buildScopeMeta(input: {
    scope: ResolvedScope;
    attributionMode: ReportAttributionMode;
    hasUnattributedData: boolean;
  }): ReportScopeMeta {
    return {
      scopeType: input.scope.scopeType,
      requestedCounterpartyIds: input.scope.requestedCounterpartyIds,
      requestedGroupIds: input.scope.requestedGroupIds,
      requestedBookIds: input.scope.requestedBookIds,
      resolvedCounterpartyIdsCount: input.scope.resolvedCounterpartyIds.length,
      attributionMode: input.attributionMode,
      hasUnattributedData: input.hasUnattributedData,
    };
  }

  async function fetchScopedPostings(input: {
    scope: ResolvedScope;
    attributionMode: ReportAttributionMode;
    statuses: FinancialResultStatus[];
    from?: Date;
    to?: Date;
    asOf?: Date;
    currency?: string;
    includeUnattributed: boolean;
  }): Promise<ScopedPosting[]> {
    if (
      (input.scope.scopeType === "counterparty" ||
        input.scope.scopeType === "group") &&
      input.scope.resolvedCounterpartyIds.length === 0
    ) {
      return [];
    }

    if (input.scope.scopeType === "book" && input.scope.resolvedBookIds.length === 0) {
      return [];
    }

    const internalLedgerOrganizationIds =
      input.attributionMode === "book_org"
        ? await listInternalLedgerOrganizationIds()
        : [];
    const internalLedgerOrganizationIdSet = new Set(internalLedgerOrganizationIds);

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

    const conditions: SQL[] = [
      sql`lo.status IN (${sql.join(
        input.statuses.map((status) => sql`${status}`),
        sql`, `,
      )})`,
    ];

    if (input.from) {
      conditions.push(sql`lo.posting_date >= ${input.from}`);
    }

    if (input.to) {
      conditions.push(sql`lo.posting_date <= ${input.to}`);
    }

    if (input.asOf) {
      conditions.push(sql`lo.posting_date <= ${input.asOf}`);
    }

    if (input.currency) {
      conditions.push(sql`p.currency = ${input.currency}`);
    }

    if (input.scope.scopeType === "book") {
      conditions.push(
        sql`p.book_id IN (${sql.join(
          input.scope.resolvedBookIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    } else if (
      input.scope.scopeType === "counterparty" ||
      input.scope.scopeType === "group"
    ) {
      if (input.attributionMode === "analytic_counterparty") {
        conditions.push(
          sql`${analyticAttributionSql} IN (${sql.join(
            input.scope.resolvedCounterpartyIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );
      } else {
        const bookScopedOrganizationIds = input.scope.resolvedCounterpartyIds.filter((id) =>
          internalLedgerOrganizationIdSet.has(id),
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

    if (input.attributionMode === "book_org") {
      if (internalLedgerOrganizationIds.length === 0) {
        return [];
      }
      conditions.push(
        sql`b.owner_id IN (${sql.join(
          internalLedgerOrganizationIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    }

    if (input.attributionMode === "analytic_counterparty" && !input.includeUnattributed) {
      conditions.push(sql`${analyticAttributionSql} IS NOT NULL`);
    }

    const whereSql = conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`true`;

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
        p.amount_minor,
        p.posting_code,
        debit_inst.account_no AS debit_account_no,
        credit_inst.account_no AS credit_account_no,
        ${analyticAttributionSql} AS analytic_counterparty_id,
        d.id::text AS document_id,
        d.doc_type AS document_type,
        COALESCE(d.payload->>'channel', lo.source_type) AS channel
      FROM ${schema.postings} p
      INNER JOIN ${schema.ledgerOperations} lo
        ON lo.id = p.operation_id
      INNER JOIN ${schema.bookAccountInstances} debit_inst
        ON debit_inst.id = p.debit_instance_id
      INNER JOIN ${schema.bookAccountInstances} credit_inst
        ON credit_inst.id = p.credit_instance_id
      LEFT JOIN ${schema.books} b
        ON b.id = p.book_id
      LEFT JOIN ${DOCUMENT_OPERATIONS_TABLE} dop
        ON dop.operation_id = lo.id
      LEFT JOIN ${DOCUMENTS_TABLE} d
        ON d.id = dop.document_id
      WHERE ${whereSql}
      ORDER BY lo.posting_date, p.operation_id, p.line_no
    `);

    const rows = (result.rows ?? []) as {
      operation_id: string;
      line_no: number;
      posting_date: Date;
      status: FinancialResultStatus;
      book_id: string;
      book_name: string | null;
      book_counterparty_id: string | null;
      currency: string;
      amount_minor: unknown;
      posting_code: string;
      debit_account_no: string;
      credit_account_no: string;
      analytic_counterparty_id: string | null;
      document_id: string | null;
      document_type: string | null;
      channel: string | null;
    }[];

    return rows.map((row) => ({
      operationId: row.operation_id,
      lineNo: row.line_no,
      postingDate: new Date(row.posting_date),
      status: row.status,
      bookId: row.book_id,
      bookLabel: row.book_name,
      bookCounterpartyId: row.book_counterparty_id,
      currency: row.currency,
      amountMinor: toBigInt(row.amount_minor),
      postingCode: row.posting_code,
      debitAccountNo: row.debit_account_no,
      creditAccountNo: row.credit_account_no,
      analyticCounterpartyId: row.analytic_counterparty_id,
      documentId: row.document_id,
      documentType: row.document_type,
      channel: row.channel,
    }));
  }

  return {
    listInternalLedgerOrganizationIds,
    resolveScope,
    buildScopeMeta,
    fetchScopedPostings,
  };
}
