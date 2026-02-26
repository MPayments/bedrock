import { eq, inArray, sql, type SQL } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import {
  paginateInMemory,
  resolveSortOrder,
  sortInMemory,
  type PaginatedList,
} from "@bedrock/kernel/pagination";

import {
  createAccountingServiceContext,
  type AccountingServiceDeps,
} from "./internal/context";
import {
  ListFinancialResultsByCounterpartyQuerySchema,
  ListFinancialResultsByGroupQuerySchema,
  replaceCorrespondenceRulesSchema,
  type ListFinancialResultsByCounterpartyQuery,
  type ListFinancialResultsByGroupQuery,
  type ReplaceCorrespondenceRulesInput,
} from "./validation";

export type AccountingService = ReturnType<typeof createAccountingService>;

type FinancialResultStatus = "pending" | "posted" | "failed";

interface FinancialResultAttributionDelta {
  attributionId: string | null;
  currency: string;
  revenueMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
}

interface FinancialResultSummaryByCurrency {
  currency: string;
  revenueMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
}

interface FinancialResultsByCounterpartyRow {
  entityType: "counterparty" | "unattributed";
  counterpartyId: string | null;
  counterpartyName: string | null;
  currency: string;
  revenueMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
}

interface FinancialResultsByCounterpartyResult extends PaginatedList<FinancialResultsByCounterpartyRow> {
  summaryByCurrency: FinancialResultSummaryByCurrency[];
}

interface FinancialResultsByGroupRow {
  groupId: string;
  groupCode: string | null;
  groupName: string | null;
  currency: string;
  revenueMinor: bigint;
  expenseMinor: bigint;
  netMinor: bigint;
}

interface FinancialResultsByGroupResult extends PaginatedList<FinancialResultsByGroupRow> {
  summaryByCurrency: FinancialResultSummaryByCurrency[];
  unattributedByCurrency: FinancialResultSummaryByCurrency[];
}

export function createAccountingService(deps: AccountingServiceDeps) {
  const context = createAccountingServiceContext(deps);
  const { db } = context;

  async function listTemplateAccounts() {
    return db
      .select()
      .from(schema.chartTemplateAccounts)
      .orderBy(schema.chartTemplateAccounts.accountNo);
  }

  async function listCorrespondenceRules() {
    return db
      .select()
      .from(schema.correspondenceRules)
      .orderBy(
        schema.correspondenceRules.postingCode,
        schema.correspondenceRules.debitAccountNo,
        schema.correspondenceRules.creditAccountNo,
      );
  }

  async function replaceCorrespondenceRules(
    input: ReplaceCorrespondenceRulesInput,
  ) {
    const validated = replaceCorrespondenceRulesSchema.parse(input);

    return db.transaction(async (tx) => {
      await tx.delete(schema.correspondenceRules);

      if (validated.rules.length === 0) {
        return [];
      }

      return tx
        .insert(schema.correspondenceRules)
        .values(
          validated.rules.map((rule) => ({
            postingCode: rule.postingCode,
            debitAccountNo: rule.debitAccountNo,
            creditAccountNo: rule.creditAccountNo,
            enabled: rule.enabled,
          })),
        )
        .returning();
    });
  }

  async function validatePostingMatrix() {
    const [rules, accounts, accountDimPolicies, postingCodeDimPolicies] = await Promise.all([
      db
        .select()
        .from(schema.correspondenceRules)
        .where(eq(schema.correspondenceRules.enabled, true)),
      db.select().from(schema.chartTemplateAccounts),
      db.select().from(schema.chartAccountDimensionPolicy),
      db
        .select()
        .from(schema.postingCodeDimensionPolicy)
        .where(eq(schema.postingCodeDimensionPolicy.required, true)),
    ]);

    const errors: {
      code: string;
      message: string;
      postingCode?: string;
      accountNo?: string;
    }[] = [];

    const activeAccounts = new Map(
      accounts.map((account) => [account.accountNo, account]),
    );
    const requiredAccountDimsByNo = new Map<string, Set<string>>();

    for (const row of accountDimPolicies) {
      if (row.mode !== "required") continue;
      const existing = requiredAccountDimsByNo.get(row.accountNo);
      if (existing) {
        existing.add(row.dimensionKey);
      } else {
        requiredAccountDimsByNo.set(
          row.accountNo,
          new Set([row.dimensionKey]),
        );
      }
    }

    interface ScopedDim { dimensionKey: string; scope: string }
    const requiredPostingCodeDims = new Map<string, ScopedDim[]>();
    for (const row of postingCodeDimPolicies) {
      const existing = requiredPostingCodeDims.get(row.postingCode);
      const entry = { dimensionKey: row.dimensionKey, scope: (row as any).scope ?? "line" };
      if (existing) {
        existing.push(entry);
      } else {
        requiredPostingCodeDims.set(row.postingCode, [entry]);
      }
    }

    const duplicateRuleCounts = new Map<string, number>();

    for (const rule of rules) {
      const key = [
        rule.postingCode,
        rule.debitAccountNo,
        rule.creditAccountNo,
      ].join("|");
      duplicateRuleCounts.set(key, (duplicateRuleCounts.get(key) ?? 0) + 1);

      for (const accountNo of [rule.debitAccountNo, rule.creditAccountNo]) {
        const account = activeAccounts.get(accountNo);
        if (!account) {
          errors.push({
            code: "ACCOUNT_NOT_FOUND",
            message: `Rule references unknown account ${accountNo}`,
            postingCode: rule.postingCode,
            accountNo,
          });
          continue;
        }

        if (!account.postingAllowed) {
          errors.push({
            code: "ACCOUNT_NOT_POSTABLE",
            message: `Rule references non-postable account ${accountNo}`,
            postingCode: rule.postingCode,
            accountNo,
          });
        }

        if (!account.enabled) {
          errors.push({
            code: "ACCOUNT_DISABLED",
            message: `Rule references disabled account ${accountNo}`,
            postingCode: rule.postingCode,
            accountNo,
          });
        }

        const accountRequired =
          requiredAccountDimsByNo.get(accountNo) ?? new Set<string>();
        const postingEntries =
          requiredPostingCodeDims.get(rule.postingCode) ?? [];
        const isDebitSide = accountNo === rule.debitAccountNo;
        const postingDimKeys = new Set(
          postingEntries
            .filter((e) => {
              if (e.scope === "line") return true;
              if (e.scope === "debit" && isDebitSide) return true;
              if (e.scope === "credit" && !isDebitSide) return true;
              return false;
            })
            .map((e) => e.dimensionKey),
        );

        for (const dimKey of accountRequired) {
          if (!postingDimKeys.has(dimKey)) {
            errors.push({
              code: "ACCOUNT_DIMENSION_UNSATISFIED",
              message: `Posting code ${rule.postingCode} does not declare required dimension ${dimKey} for account ${accountNo} (${isDebitSide ? "debit" : "credit"} side)`,
              postingCode: rule.postingCode,
              accountNo,
            });
          }
        }
      }

      const pEntries = requiredPostingCodeDims.get(rule.postingCode);
      if (!pEntries || pEntries.length === 0) {
        errors.push({
          code: "POSTING_CODE_DIMENSIONS_UNDECLARED",
          message: `Posting code ${rule.postingCode} has no declared dimension policies`,
          postingCode: rule.postingCode,
        });
      }
    }

    for (const [key, count] of duplicateRuleCounts) {
      if (count > 1) {
        const [postingCode, debitAccountNo, creditAccountNo] = key.split("|");
        errors.push({
          code: "DUPLICATE_ACTIVE_RULE",
          message: `Duplicate active rule for postingCode=${postingCode}, debit=${debitAccountNo}, credit=${creditAccountNo}`,
          postingCode,
        });
      }
    }

    return {
      ok: errors.length === 0,
      errors,
    };
  }

  function parseOptionalIsoDate(
    value: string | undefined,
    field: "from" | "to",
  ): Date | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error(`${field} must be a valid ISO datetime`);
    }

    return parsed;
  }

  function normalizeCurrency(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    return value.trim().toUpperCase();
  }

  function toBigInt(value: unknown): bigint {
    if (typeof value === "bigint") {
      return value;
    }

    if (typeof value === "number") {
      return BigInt(value);
    }

    if (typeof value === "string") {
      return BigInt(value);
    }

    return 0n;
  }

  function summarizeByCurrency(
    rows: {
      currency: string;
      revenueMinor: bigint;
      expenseMinor: bigint;
      netMinor: bigint;
    }[],
  ): FinancialResultSummaryByCurrency[] {
    const summaryByCurrency = new Map<
      string,
      FinancialResultSummaryByCurrency
    >();

    for (const row of rows) {
      const existing = summaryByCurrency.get(row.currency);
      if (existing) {
        existing.revenueMinor += row.revenueMinor;
        existing.expenseMinor += row.expenseMinor;
        existing.netMinor += row.netMinor;
        continue;
      }

      summaryByCurrency.set(row.currency, {
        currency: row.currency,
        revenueMinor: row.revenueMinor,
        expenseMinor: row.expenseMinor,
        netMinor: row.netMinor,
      });
    }

    return Array.from(summaryByCurrency.values()).sort((a, b) =>
      a.currency.localeCompare(b.currency),
    );
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
  }

  async function fetchCounterpartyNames(
    ids: string[],
  ): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }

    const rows = await db
      .select({
        id: schema.counterparties.id,
        shortName: schema.counterparties.shortName,
      })
      .from(schema.counterparties)
      .where(inArray(schema.counterparties.id, ids));

    return new Map(rows.map((row) => [row.id, row.shortName]));
  }

  async function fetchGroupMeta(
    ids: string[],
  ): Promise<Map<string, { code: string | null; name: string | null }>> {
    if (ids.length === 0) {
      return new Map();
    }

    const rows = await db
      .select({
        id: schema.counterpartyGroups.id,
        code: schema.counterpartyGroups.code,
        name: schema.counterpartyGroups.name,
      })
      .from(schema.counterpartyGroups)
      .where(inArray(schema.counterpartyGroups.id, ids));

    return new Map(
      rows.map((row) => [row.id, { code: row.code, name: row.name }]),
    );
  }

  async function fetchAttributionDeltas(input: {
    attributionMode: "book_org" | "analytic_counterparty";
    statuses: FinancialResultStatus[];
    from?: Date;
    to?: Date;
    currency?: string;
    counterpartyId?: string;
    allowedCounterpartyIds?: string[];
    requireNullAttribution?: boolean;
  }): Promise<FinancialResultAttributionDelta[]> {
    if (
      input.allowedCounterpartyIds &&
      input.allowedCounterpartyIds.length === 0
    ) {
      return [];
    }

    const conditions: SQL[] = [
      sql`lo.status IN (${sql.join(
        input.statuses.map((status) => sql`${status}`),
        sql`, `,
      )})`,
      sql`(debit_acc.kind IN ('revenue', 'expense') OR credit_acc.kind IN ('revenue', 'expense'))`,
    ];

    if (input.from) {
      conditions.push(sql`lo.posting_date >= ${input.from}`);
    }

    if (input.to) {
      conditions.push(sql`lo.posting_date <= ${input.to}`);
    }

    if (input.currency) {
      conditions.push(sql`p.currency = ${input.currency}`);
    }

    const attributionSql =
      input.attributionMode === "book_org"
        ? sql`p.book_org_id::text`
        : sql`COALESCE(
            debit_inst.dimensions->>'counterpartyId',
            credit_inst.dimensions->>'counterpartyId'
          )`;

    if (input.requireNullAttribution) {
      conditions.push(sql`${attributionSql} IS NULL`);
    } else {
      if (input.counterpartyId) {
        conditions.push(sql`${attributionSql} = ${input.counterpartyId}`);
      }

      if (input.allowedCounterpartyIds?.length) {
        conditions.push(
          sql`${attributionSql} IN (${sql.join(
            input.allowedCounterpartyIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );
      }
    }

    const whereSql = sql.join(conditions, sql` AND `);

    const result = await db.execute(sql`
      SELECT
        ${attributionSql} AS attribution_id,
        p.currency AS currency,
        COALESCE(
          SUM(
            CASE
              WHEN credit_acc.kind = 'revenue' THEN p.amount_minor
              WHEN debit_acc.kind = 'revenue' THEN -p.amount_minor
              ELSE 0
            END
          ),
          0
        )::bigint AS revenue_minor,
        COALESCE(
          SUM(
            CASE
              WHEN debit_acc.kind = 'expense' THEN p.amount_minor
              WHEN credit_acc.kind = 'expense' THEN -p.amount_minor
              ELSE 0
            END
          ),
          0
        )::bigint AS expense_minor
      FROM ${schema.postings} p
      INNER JOIN ${schema.ledgerOperations} lo
        ON lo.id = p.operation_id
      INNER JOIN ${schema.bookAccountInstances} debit_inst
        ON debit_inst.id = p.debit_instance_id
      INNER JOIN ${schema.chartTemplateAccounts} debit_acc
        ON debit_acc.account_no = debit_inst.account_no
      INNER JOIN ${schema.bookAccountInstances} credit_inst
        ON credit_inst.id = p.credit_instance_id
      INNER JOIN ${schema.chartTemplateAccounts} credit_acc
        ON credit_acc.account_no = credit_inst.account_no
      WHERE ${whereSql}
      GROUP BY ${attributionSql}, p.currency
    `);

    const rows = (result.rows ?? []) as {
      attribution_id: string | null;
      currency: string;
      revenue_minor: unknown;
      expense_minor: unknown;
    }[];

    return rows.map((row) => {
      const revenueMinor = toBigInt(row.revenue_minor);
      const expenseMinor = toBigInt(row.expense_minor);

      return {
        attributionId: row.attribution_id,
        currency: row.currency,
        revenueMinor,
        expenseMinor,
        netMinor: revenueMinor - expenseMinor,
      };
    });
  }

  async function listFinancialResultsByCounterparty(
    input?: ListFinancialResultsByCounterpartyQuery,
  ): Promise<FinancialResultsByCounterpartyResult> {
    const query = ListFinancialResultsByCounterpartyQuerySchema.parse(
      input ?? {},
    );
    const attributionMode: "book_org" | "analytic_counterparty" =
      query.attributionMode === "analytic_counterparty"
        ? "analytic_counterparty"
        : "book_org";
    const statuses = ((query.status?.length
      ? query.status
      : ["posted", "pending"]) ?? [
      "posted",
      "pending",
    ]) as FinancialResultStatus[];
    const includeDescendants = query.includeDescendants ?? true;
    const from = parseOptionalIsoDate(query.from, "from");
    const to = parseOptionalIsoDate(query.to, "to");
    const currency = normalizeCurrency(query.currency);

    if (from && to && from > to) {
      throw new Error("from must be earlier than or equal to to");
    }

    let allowedCounterpartyIds: string[] | undefined;
    if (query.groupId) {
      const groupRows = await resolveGroupMemberRows(
        [query.groupId],
        includeDescendants,
      );
      allowedCounterpartyIds = Array.from(
        new Set(groupRows.map((row) => row.counterpartyId)),
      );
      if (allowedCounterpartyIds.length === 0) {
        return {
          data: [],
          total: 0,
          limit: query.limit,
          offset: query.offset,
          summaryByCurrency: [],
        };
      }
    }

    const deltas = await fetchAttributionDeltas({
      attributionMode,
      statuses,
      from,
      to,
      currency,
      counterpartyId: query.counterpartyId,
      allowedCounterpartyIds,
    });

    const counterpartyIds = Array.from(
      new Set(
        deltas
          .map((row) => row.attributionId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const namesById = await fetchCounterpartyNames(counterpartyIds);

    const rows: FinancialResultsByCounterpartyRow[] = deltas.map((row) => ({
      entityType: row.attributionId ? "counterparty" : "unattributed",
      counterpartyId: row.attributionId,
      counterpartyName: row.attributionId
        ? (namesById.get(row.attributionId) ?? null)
        : "Unattributed",
      currency: row.currency,
      revenueMinor: row.revenueMinor,
      expenseMinor: row.expenseMinor,
      netMinor: row.netMinor,
    }));

    const sortMap = {
      entityName: (row: FinancialResultsByCounterpartyRow) =>
        row.counterpartyName ?? "Unattributed",
      currency: (row: FinancialResultsByCounterpartyRow) => row.currency,
      revenueMinor: (row: FinancialResultsByCounterpartyRow) =>
        row.revenueMinor,
      expenseMinor: (row: FinancialResultsByCounterpartyRow) =>
        row.expenseMinor,
      netMinor: (row: FinancialResultsByCounterpartyRow) => row.netMinor,
    };

    const sortedRows = sortInMemory(rows, {
      sortBy: query.sortBy as keyof typeof sortMap,
      sortOrder: resolveSortOrder(query.sortOrder),
      sortMap,
    });
    const paginated = paginateInMemory(sortedRows, {
      limit: query.limit,
      offset: query.offset,
    });

    return {
      ...paginated,
      summaryByCurrency: summarizeByCurrency(rows),
    };
  }

  async function listFinancialResultsByGroup(
    input?: ListFinancialResultsByGroupQuery,
  ): Promise<FinancialResultsByGroupResult> {
    const query = ListFinancialResultsByGroupQuerySchema.parse(input ?? {});
    const attributionMode: "book_org" | "analytic_counterparty" =
      query.attributionMode === "analytic_counterparty"
        ? "analytic_counterparty"
        : "book_org";
    const statuses = ((query.status?.length
      ? query.status
      : ["posted", "pending"]) ?? [
      "posted",
      "pending",
    ]) as FinancialResultStatus[];
    const includeDescendants = query.includeDescendants ?? true;
    const from = parseOptionalIsoDate(query.from, "from");
    const to = parseOptionalIsoDate(query.to, "to");
    const currency = normalizeCurrency(query.currency);
    const groupIds = Array.from(new Set(query.groupId ?? []));

    if (from && to && from > to) {
      throw new Error("from must be earlier than or equal to to");
    }

    const membershipRows = await resolveGroupMemberRows(
      groupIds,
      includeDescendants,
    );
    const membersByGroup = new Map<string, Set<string>>();

    for (const groupId of groupIds) {
      membersByGroup.set(groupId, new Set());
    }

    for (const row of membershipRows) {
      const members = membersByGroup.get(row.rootGroupId);
      if (members) {
        members.add(row.counterpartyId);
      }
    }

    const relevantCounterpartyIds = Array.from(
      new Set(membershipRows.map((row) => row.counterpartyId)),
    );

    const attributionDeltas =
      relevantCounterpartyIds.length === 0
        ? []
        : await fetchAttributionDeltas({
            attributionMode,
            statuses,
            from,
            to,
            currency,
            allowedCounterpartyIds: relevantCounterpartyIds,
          });

    const deltasByAttribution = new Map<
      string,
      FinancialResultAttributionDelta[]
    >();
    for (const delta of attributionDeltas) {
      if (!delta.attributionId) {
        continue;
      }

      const bucket = deltasByAttribution.get(delta.attributionId);
      if (bucket) {
        bucket.push(delta);
      } else {
        deltasByAttribution.set(delta.attributionId, [delta]);
      }
    }

    const aggregateByGroupCurrency = new Map<
      string,
      {
        groupId: string;
        currency: string;
        revenueMinor: bigint;
        expenseMinor: bigint;
        netMinor: bigint;
      }
    >();

    for (const groupId of groupIds) {
      const members = membersByGroup.get(groupId) ?? new Set<string>();
      for (const counterpartyId of members) {
        const deltas = deltasByAttribution.get(counterpartyId) ?? [];
        for (const delta of deltas) {
          const key = `${groupId}:${delta.currency}`;
          const existing = aggregateByGroupCurrency.get(key);
          if (existing) {
            existing.revenueMinor += delta.revenueMinor;
            existing.expenseMinor += delta.expenseMinor;
            existing.netMinor += delta.netMinor;
            continue;
          }

          aggregateByGroupCurrency.set(key, {
            groupId,
            currency: delta.currency,
            revenueMinor: delta.revenueMinor,
            expenseMinor: delta.expenseMinor,
            netMinor: delta.netMinor,
          });
        }
      }
    }

    const groupMetaById = await fetchGroupMeta(groupIds);

    const rows: FinancialResultsByGroupRow[] = Array.from(
      aggregateByGroupCurrency.values(),
    ).map((row) => ({
      groupId: row.groupId,
      groupCode: groupMetaById.get(row.groupId)?.code ?? null,
      groupName: groupMetaById.get(row.groupId)?.name ?? null,
      currency: row.currency,
      revenueMinor: row.revenueMinor,
      expenseMinor: row.expenseMinor,
      netMinor: row.netMinor,
    }));

    const sortMap = {
      groupName: (row: FinancialResultsByGroupRow) => row.groupName ?? "",
      currency: (row: FinancialResultsByGroupRow) => row.currency,
      revenueMinor: (row: FinancialResultsByGroupRow) => row.revenueMinor,
      expenseMinor: (row: FinancialResultsByGroupRow) => row.expenseMinor,
      netMinor: (row: FinancialResultsByGroupRow) => row.netMinor,
    };

    const sortedRows = sortInMemory(rows, {
      sortBy: query.sortBy as keyof typeof sortMap,
      sortOrder: resolveSortOrder(query.sortOrder),
      sortMap,
    });
    const paginated = paginateInMemory(sortedRows, {
      limit: query.limit,
      offset: query.offset,
    });

    const unattributedRows =
      attributionMode === "analytic_counterparty"
        ? await fetchAttributionDeltas({
            attributionMode,
            statuses,
            from,
            to,
            currency,
            requireNullAttribution: true,
          })
        : [];
    const unattributedByCurrency = summarizeByCurrency(unattributedRows);

    return {
      ...paginated,
      summaryByCurrency: summarizeByCurrency(rows),
      unattributedByCurrency,
    };
  }

  return {
    listTemplateAccounts,
    listCorrespondenceRules,
    replaceCorrespondenceRules,
    validatePostingMatrix,
    listFinancialResultsByCounterparty,
    listFinancialResultsByGroup,
  };
}
