import {
  and,
  asc,
  desc,
  eq,
  sql,
  type SQL,
} from "drizzle-orm";

import type { CurrenciesQueries } from "@bedrock/currencies/queries";
import type { Queryable } from "@bedrock/platform/persistence";
import {
  resolveSortOrder,
  resolveSortValue,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import {
  agreementFeeRules,
  agreementParties,
  agreements,
  agreementVersions,
} from "./schema";
import type {
  Agreement,
  AgreementDetails,
  AgreementFeeRule,
  AgreementParty,
  AgreementVersion,
  AgreementVersionSummary,
} from "../../application/contracts/dto";
import type { ListAgreementsQuery } from "../../application/contracts/queries";
import type { AgreementReads } from "../../application/ports/agreement.reads";

const AGREEMENTS_SORT_COLUMN_MAP = {
  contractNumber: agreementVersions.contractNumber,
  createdAt: agreements.createdAt,
  updatedAt: agreements.updatedAt,
} as const;

const agreementSummarySelect = {
  id: agreements.id,
  customerId: agreements.customerId,
  organizationId: agreements.organizationId,
  organizationRequisiteId: agreements.organizationRequisiteId,
  isActive: agreements.isActive,
  createdAt: agreements.createdAt,
  updatedAt: agreements.updatedAt,
  currentVersionId: agreementVersions.id,
  currentVersionNumber: agreementVersions.versionNumber,
  currentVersionContractNumber: agreementVersions.contractNumber,
  currentVersionContractDate: agreementVersions.contractDate,
  currentVersionCreatedAt: agreementVersions.createdAt,
  currentVersionUpdatedAt: agreementVersions.updatedAt,
};

interface AgreementSummaryRow {
  id: string;
  customerId: string;
  organizationId: string;
  organizationRequisiteId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  currentVersionId: string;
  currentVersionNumber: number;
  currentVersionContractNumber: string | null;
  currentVersionContractDate: Date | null;
  currentVersionCreatedAt: Date;
  currentVersionUpdatedAt: Date;
}

function mapAgreementVersionSummary(
  row: AgreementSummaryRow,
): AgreementVersionSummary {
  return {
    id: row.currentVersionId,
    versionNumber: Number(row.currentVersionNumber),
    contractNumber: row.currentVersionContractNumber,
    contractDate: row.currentVersionContractDate,
    createdAt: row.currentVersionCreatedAt,
    updatedAt: row.currentVersionUpdatedAt,
  };
}

function mapAgreementSummary(row: AgreementSummaryRow): Agreement {
  return {
    id: row.id,
    customerId: row.customerId,
    organizationId: row.organizationId,
    organizationRequisiteId: row.organizationRequisiteId,
    isActive: row.isActive,
    currentVersion: mapAgreementVersionSummary(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapFeeRuleRow(row: {
  id: string;
  kind: "agent_fee" | "fixed_fee";
  unit: "bps" | "money";
  valueNumeric: string;
  currencyId: string | null;
  currencyCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AgreementFeeRule {
  return {
    id: row.id,
    kind: row.kind,
    unit: row.unit,
    value: row.valueNumeric,
    currencyId: row.currencyId,
    currencyCode: row.currencyCode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapPartyRow(row: {
  id: string;
  partyRole: "customer" | "organization";
  customerId: string | null;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AgreementParty {
  return {
    id: row.id,
    partyRole: row.partyRole,
    partyId: row.customerId ?? row.organizationId!,
    customerId: row.customerId,
    organizationId: row.organizationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleAgreementReads implements AgreementReads {
  constructor(
    private readonly db: Queryable,
    private readonly currenciesQueries: Pick<CurrenciesQueries, "listByIds">,
  ) {}

  async findById(id: string): Promise<AgreementDetails | null> {
    const [summary] = (await this.db
      .select(agreementSummarySelect)
      .from(agreements)
      .innerJoin(agreementVersions, eq(agreements.currentVersionId, agreementVersions.id))
      .where(eq(agreements.id, id))
      .limit(1)) as AgreementSummaryRow[];

    if (!summary) {
      return null;
    }

    const [feeRuleRows, partyRows] = await Promise.all([
      this.db
        .select({
          id: agreementFeeRules.id,
          kind: agreementFeeRules.kind,
          unit: agreementFeeRules.unit,
          valueNumeric: agreementFeeRules.valueNumeric,
          currencyId: agreementFeeRules.currencyId,
          createdAt: agreementFeeRules.createdAt,
          updatedAt: agreementFeeRules.updatedAt,
        })
        .from(agreementFeeRules)
        .where(eq(agreementFeeRules.agreementVersionId, summary.currentVersionId))
        .orderBy(asc(agreementFeeRules.createdAt)),
      this.db
        .select({
          id: agreementParties.id,
          partyRole: agreementParties.partyRole,
          customerId: agreementParties.customerId,
          organizationId: agreementParties.organizationId,
          createdAt: agreementParties.createdAt,
          updatedAt: agreementParties.updatedAt,
        })
        .from(agreementParties)
        .where(eq(agreementParties.agreementVersionId, summary.currentVersionId))
        .orderBy(asc(agreementParties.createdAt)),
    ]);
    const currenciesById = await this.currenciesQueries.listByIds(
      feeRuleRows
        .map((row) => row.currencyId)
        .filter((currencyId): currencyId is string => Boolean(currencyId)),
    );

    const currentVersion: AgreementVersion = {
      ...mapAgreementVersionSummary(summary),
      feeRules: feeRuleRows.map((row) =>
        mapFeeRuleRow({
          ...row,
          currencyCode: row.currencyId
            ? currenciesById.get(row.currencyId)?.code ?? null
            : null,
        }),
      ),
      parties: partyRows.map(mapPartyRow),
    };

    return {
      id: summary.id,
      customerId: summary.customerId,
      organizationId: summary.organizationId,
      organizationRequisiteId: summary.organizationRequisiteId,
      isActive: summary.isActive,
      currentVersion,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    };
  }

  async list(input: ListAgreementsQuery): Promise<PaginatedList<Agreement>> {
    const conditions: SQL[] = [];

    if (input.customerId) {
      conditions.push(eq(agreements.customerId, input.customerId));
    }

    if (input.organizationId) {
      conditions.push(eq(agreements.organizationId, input.organizationId));
    }

    if (input.isActive !== undefined) {
      conditions.push(eq(agreements.isActive, input.isActive));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const orderByFn = resolveSortOrder(input.sortOrder) === "desc" ? desc : asc;
    const orderByColumn = resolveSortValue(
      input.sortBy,
      AGREEMENTS_SORT_COLUMN_MAP,
      agreements.createdAt,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select(agreementSummarySelect)
        .from(agreements)
        .innerJoin(
          agreementVersions,
          eq(agreements.currentVersionId, agreementVersions.id),
        )
        .where(where)
        .orderBy(orderByFn(orderByColumn))
        .limit(input.limit)
        .offset(input.offset) as Promise<AgreementSummaryRow[]>,
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(agreements)
        .where(where),
    ]);

    return {
      data: rows.map(mapAgreementSummary),
      total: countRows[0]?.total ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  }

  async findActiveByCustomerId(customerId: string): Promise<AgreementDetails | null> {
    const [summary] = (await this.db
      .select(agreementSummarySelect)
      .from(agreements)
      .innerJoin(
        agreementVersions,
        eq(agreements.currentVersionId, agreementVersions.id),
      )
      .where(
        and(
          eq(agreements.customerId, customerId),
          eq(agreements.isActive, true),
        ),
      )
      .orderBy(desc(agreements.updatedAt), desc(agreements.createdAt))
      .limit(1)) as AgreementSummaryRow[];

    if (!summary) {
      return null;
    }

    return this.findById(summary.id);
  }
}
