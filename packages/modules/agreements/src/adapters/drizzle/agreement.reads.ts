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
  agreementRoutePolicies,
  agreementRouteTemplateLinks,
  agreements,
  agreementVersions,
} from "./schema";
import type {
  Agreement,
  AgreementDetails,
  AgreementFeeRule,
  AgreementParty,
  AgreementRoutePolicy,
  AgreementRouteTemplateLink,
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

function mapRouteTemplateLinkRow(row: {
  id: string;
  routeTemplateId: string;
  sequence: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AgreementRouteTemplateLink {
  return {
    id: row.id,
    routeTemplateId: row.routeTemplateId,
    sequence: row.sequence,
    isDefault: row.isDefault,
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

    const [feeRuleRows, partyRows, routePolicyRows, routeTemplateLinkRows] =
      await Promise.all([
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
      this.db
        .select({
          id: agreementRoutePolicies.id,
          agreementVersionId: agreementRoutePolicies.agreementVersionId,
          sequence: agreementRoutePolicies.sequence,
          dealType: agreementRoutePolicies.dealType,
          sourceCurrencyId: agreementRoutePolicies.sourceCurrencyId,
          targetCurrencyId: agreementRoutePolicies.targetCurrencyId,
          defaultMarkupBps: agreementRoutePolicies.defaultMarkupBps,
          defaultWireFeeAmountMinor:
            agreementRoutePolicies.defaultWireFeeAmountMinor,
          defaultWireFeeCurrencyId:
            agreementRoutePolicies.defaultWireFeeCurrencyId,
          defaultSubAgentCommissionUnit:
            agreementRoutePolicies.defaultSubAgentCommissionUnit,
          defaultSubAgentCommissionBps:
            agreementRoutePolicies.defaultSubAgentCommissionBps,
          defaultSubAgentCommissionAmountMinor:
            agreementRoutePolicies.defaultSubAgentCommissionAmountMinor,
          defaultSubAgentCommissionCurrencyId:
            agreementRoutePolicies.defaultSubAgentCommissionCurrencyId,
          approvalThresholdAmountMinor:
            agreementRoutePolicies.approvalThresholdAmountMinor,
          approvalThresholdCurrencyId:
            agreementRoutePolicies.approvalThresholdCurrencyId,
          quoteValiditySeconds: agreementRoutePolicies.quoteValiditySeconds,
          createdAt: agreementRoutePolicies.createdAt,
          updatedAt: agreementRoutePolicies.updatedAt,
        })
        .from(agreementRoutePolicies)
        .where(eq(agreementRoutePolicies.agreementVersionId, summary.currentVersionId))
        .orderBy(
          asc(agreementRoutePolicies.sequence),
          asc(agreementRoutePolicies.createdAt),
        ),
      this.db
        .select({
          id: agreementRouteTemplateLinks.id,
          agreementRoutePolicyId:
            agreementRouteTemplateLinks.agreementRoutePolicyId,
          routeTemplateId: agreementRouteTemplateLinks.routeTemplateId,
          sequence: agreementRouteTemplateLinks.sequence,
          isDefault: agreementRouteTemplateLinks.isDefault,
          createdAt: agreementRouteTemplateLinks.createdAt,
          updatedAt: agreementRouteTemplateLinks.updatedAt,
        })
        .from(agreementRouteTemplateLinks)
        .innerJoin(
          agreementRoutePolicies,
          eq(
            agreementRouteTemplateLinks.agreementRoutePolicyId,
            agreementRoutePolicies.id,
          ),
        )
        .where(eq(agreementRoutePolicies.agreementVersionId, summary.currentVersionId))
        .orderBy(
          asc(agreementRouteTemplateLinks.sequence),
          asc(agreementRouteTemplateLinks.createdAt),
        ),
    ]);
    const currenciesById = await this.currenciesQueries.listByIds(
      [
        ...feeRuleRows.map((row) => row.currencyId),
        ...routePolicyRows.map((row) => row.sourceCurrencyId),
        ...routePolicyRows.map((row) => row.targetCurrencyId),
        ...routePolicyRows.map((row) => row.defaultWireFeeCurrencyId),
        ...routePolicyRows.map(
          (row) => row.defaultSubAgentCommissionCurrencyId,
        ),
        ...routePolicyRows.map((row) => row.approvalThresholdCurrencyId),
      ].filter((currencyId): currencyId is string => Boolean(currencyId)),
    );

    const templateLinksByPolicyId = new Map<string, AgreementRouteTemplateLink[]>();

    routeTemplateLinkRows.forEach((row) => {
      const current = templateLinksByPolicyId.get(row.agreementRoutePolicyId) ?? [];
      current.push(mapRouteTemplateLinkRow(row));
      templateLinksByPolicyId.set(row.agreementRoutePolicyId, current);
    });

    const routePolicies: AgreementRoutePolicy[] = routePolicyRows.map((row) => ({
      id: row.id,
      agreementVersionId: row.agreementVersionId,
      sequence: row.sequence,
      dealType: row.dealType,
      sourceCurrencyId: row.sourceCurrencyId,
      sourceCurrencyCode: row.sourceCurrencyId
        ? currenciesById.get(row.sourceCurrencyId)?.code ?? null
        : null,
      targetCurrencyId: row.targetCurrencyId,
      targetCurrencyCode: row.targetCurrencyId
        ? currenciesById.get(row.targetCurrencyId)?.code ?? null
        : null,
      defaultMarkupBps: row.defaultMarkupBps,
      defaultWireFeeAmountMinor:
        row.defaultWireFeeAmountMinor?.toString() ?? null,
      defaultWireFeeCurrencyId: row.defaultWireFeeCurrencyId,
      defaultWireFeeCurrencyCode: row.defaultWireFeeCurrencyId
        ? currenciesById.get(row.defaultWireFeeCurrencyId)?.code ?? null
        : null,
      defaultSubAgentCommissionUnit: row.defaultSubAgentCommissionUnit,
      defaultSubAgentCommissionBps: row.defaultSubAgentCommissionBps,
      defaultSubAgentCommissionAmountMinor:
        row.defaultSubAgentCommissionAmountMinor?.toString() ?? null,
      defaultSubAgentCommissionCurrencyId:
        row.defaultSubAgentCommissionCurrencyId,
      defaultSubAgentCommissionCurrencyCode:
        row.defaultSubAgentCommissionCurrencyId
          ? currenciesById.get(row.defaultSubAgentCommissionCurrencyId)?.code ?? null
          : null,
      approvalThresholdAmountMinor:
        row.approvalThresholdAmountMinor?.toString() ?? null,
      approvalThresholdCurrencyId: row.approvalThresholdCurrencyId,
      approvalThresholdCurrencyCode: row.approvalThresholdCurrencyId
        ? currenciesById.get(row.approvalThresholdCurrencyId)?.code ?? null
        : null,
      quoteValiditySeconds: row.quoteValiditySeconds,
      templateLinks: templateLinksByPolicyId.get(row.id) ?? [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

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
      routePolicies,
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
