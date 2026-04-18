import { randomUUID } from "node:crypto";

import { DrizzleAgreementReads } from "@bedrock/agreements/adapters/drizzle";
import { DrizzleCalculationReads } from "@bedrock/calculations/adapters/drizzle";
import type { CurrenciesService } from "@bedrock/currencies";
import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import {
  DrizzleCounterpartyReads,
  DrizzleCustomerReads,
} from "@bedrock/parties/adapters/drizzle";
import { createPartiesQueries } from "@bedrock/parties/queries";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
  type Queryable,
  type Transaction,
} from "@bedrock/platform/persistence";

import {
  createDealsModule,
  type DealsModule,
  type DealsModuleDeps,
} from "../../module";
import type { DealFundingAssessmentPort } from "../../application/ports/deal.reads";
import { DealTypeNotSupportedError } from "../../errors";
import { DrizzleDealReads } from "./deal.reads";
import { DrizzleDealsUnitOfWork } from "./deals.uow";

interface OrganizationRequisiteLiquidityQueryRow {
  organizationId: string;
  requisiteId: string;
  currency: string;
  availableMinor: string;
}

interface DealQuoteDetailsRecord {
  quote: {
    toAmountMinor: bigint;
    toCurrencyId: string;
    toCurrency?: string | null;
  };
}

function getMostLiquidRow(
  rows: OrganizationRequisiteLiquidityQueryRow[],
): OrganizationRequisiteLiquidityQueryRow | null {
  let mostLiquidRow: OrganizationRequisiteLiquidityQueryRow | null = null;
  let maxAvailableMinor = 0n;

  for (const row of rows) {
    const availableMinor = BigInt(row.availableMinor);

    if (!mostLiquidRow || availableMinor > maxAvailableMinor) {
      mostLiquidRow = row;
      maxAvailableMinor = availableMinor;
    }
  }

  return mostLiquidRow;
}

function getCoveringLiquidityRow(input: {
  requiredAmountMinor: bigint;
  rows: OrganizationRequisiteLiquidityQueryRow[];
}) {
  let coveringRow: OrganizationRequisiteLiquidityQueryRow | null = null;
  let maxAvailableMinor = 0n;

  for (const row of input.rows) {
    const availableMinor = BigInt(row.availableMinor);

    if (availableMinor < input.requiredAmountMinor) {
      continue;
    }

    if (!coveringRow || availableMinor > maxAvailableMinor) {
      coveringRow = row;
      maxAvailableMinor = availableMinor;
    }
  }

  return coveringRow;
}

function createDealFundingAssessmentPort(input: {
  currencies: Pick<CurrenciesService, "findById">;
  ledgerBalances: {
    listOrganizationRequisiteLiquidityRows(input: {
      organizationIds: string[];
      currency?: string;
    }): Promise<OrganizationRequisiteLiquidityQueryRow[]>;
  };
  quoteReads: {
    getQuoteDetails(input: { quoteRef: string }): Promise<DealQuoteDetailsRecord>;
  };
}): DealFundingAssessmentPort {
  return {
    async assessFunding(inputParams) {
      const fallbackTargetCurrency = inputParams.targetCurrencyId
        ? await input.currencies
            .findById(inputParams.targetCurrencyId)
            .then((currency) => currency.code)
            .catch(() => null)
        : null;

      if (!inputParams.hasConvertLeg) {
        return {
          availableMinor: null,
          fundingOrganizationId: null,
          fundingRequisiteId: null,
          reasonCode: "no_convert_leg",
          requiredAmountMinor: null,
          state: "not_applicable" as const,
          strategy: null,
          targetCurrency: fallbackTargetCurrency,
          targetCurrencyId: inputParams.targetCurrencyId,
        };
      }

      if (!inputParams.internalEntityOrganizationId) {
        return {
          availableMinor: null,
          fundingOrganizationId: null,
          fundingRequisiteId: null,
          reasonCode: "internal_entity_missing",
          requiredAmountMinor: null,
          state: "blocked" as const,
          strategy: null,
          targetCurrency: fallbackTargetCurrency,
          targetCurrencyId: inputParams.targetCurrencyId,
        };
      }

      if (!inputParams.acceptedQuoteId) {
        return {
          availableMinor: null,
          fundingOrganizationId: inputParams.internalEntityOrganizationId,
          fundingRequisiteId: null,
          reasonCode: "accepted_quote_missing",
          requiredAmountMinor: null,
          state: "blocked" as const,
          strategy: null,
          targetCurrency: fallbackTargetCurrency,
          targetCurrencyId: inputParams.targetCurrencyId,
        };
      }

      let quoteDetails: DealQuoteDetailsRecord;

      try {
        quoteDetails = await input.quoteReads.getQuoteDetails({
          quoteRef: inputParams.acceptedQuoteId,
        });
      } catch {
        return {
          availableMinor: null,
          fundingOrganizationId: inputParams.internalEntityOrganizationId,
          fundingRequisiteId: null,
          reasonCode: "accepted_quote_details_unavailable",
          requiredAmountMinor: null,
          state: "blocked" as const,
          strategy: null,
          targetCurrency: fallbackTargetCurrency,
          targetCurrencyId: inputParams.targetCurrencyId,
        };
      }

      const requiredAmountMinor = quoteDetails.quote.toAmountMinor;
      const targetCurrencyId = quoteDetails.quote.toCurrencyId;
      const targetCurrency = quoteDetails.quote.toCurrency ?? null;
      const liquidityRows =
        await input.ledgerBalances.listOrganizationRequisiteLiquidityRows({
          currency: targetCurrency ?? undefined,
          organizationIds: [inputParams.internalEntityOrganizationId],
        });
      const matchingRows = liquidityRows.filter(
        (row) =>
          row.organizationId === inputParams.internalEntityOrganizationId &&
          row.currency === targetCurrency,
      );
      const coveringRow = getCoveringLiquidityRow({
        requiredAmountMinor,
        rows: matchingRows,
      });
      const mostLiquidRow = getMostLiquidRow(matchingRows);

      return {
        availableMinor: mostLiquidRow?.availableMinor ?? null,
        fundingOrganizationId: inputParams.internalEntityOrganizationId,
        fundingRequisiteId: coveringRow?.requisiteId ?? null,
        reasonCode: coveringRow
          ? "inventory_available"
          : "inventory_insufficient",
        requiredAmountMinor: requiredAmountMinor.toString(),
        state: "resolved" as const,
        strategy: coveringRow ? ("existing_inventory" as const) : ("external_fx" as const),
        targetCurrency,
        targetCurrencyId,
      };
    },
  };
}

export interface CreateDealsModuleFromDrizzleInput {
  currencies: Pick<CurrenciesService, "findById">;
  db: Database | Transaction;
  documentsReadModel?: DealsDocumentsReadModel;
  generateUuid?: DealsModuleDeps["generateUuid"];
  idempotency: IdempotencyPort;
  ledgerBalances: {
    listOrganizationRequisiteLiquidityRows(input: {
      organizationIds: string[];
      currency?: string;
    }): Promise<OrganizationRequisiteLiquidityQueryRow[]>;
  };
  logger: Logger;
  now?: DealsModuleDeps["now"];
  persistence?: PersistenceContext;
  bindDocumentsReadModel?: (db: Queryable) => DealsDocumentsReadModel;
  quoteReads: {
    findById(id: string): Promise<{
      agreementVersionId?: string | null;
      commercialTerms?: {
        agreementVersionId: string | null;
      } | null;
      dealId: string | null;
      expiresAt: Date | null;
      id: string;
      status: string;
      usedAt: Date | null;
      usedDocumentId: string | null;
    } | null>;
    getQuoteDetails(input: { quoteRef: string }): Promise<DealQuoteDetailsRecord>;
  };
}

export interface DealsDocumentsReadModel {
  listDealTraceRowsByDealId(dealId: string): Promise<
    {
      approvalStatus: string;
      dealId: string | null;
      documentId: string;
      docType: string;
      ledgerOperationIds: string[];
      lifecycleStatus: string;
      occurredAt: Date;
      postingStatus: string;
      submissionStatus: string;
    }[]
  >;
}

export function createDealsModuleFromDrizzle(
  input: CreateDealsModuleFromDrizzleInput,
): DealsModule {
  const persistence =
    input.persistence ?? createPersistenceContext(input.db as Database);
  const currenciesQueries = createCurrenciesQueries({ db: input.db });
  const partiesQueries = createPartiesQueries({ db: input.db });
  const agreementReads = new DrizzleAgreementReads(input.db, currenciesQueries);
  const calculationReads = new DrizzleCalculationReads(input.db);
  const customerReads = new DrizzleCustomerReads(input.db);
  const counterpartyReads = new DrizzleCounterpartyReads(input.db);
  const fundingAssessment = createDealFundingAssessmentPort({
    currencies: input.currencies,
    ledgerBalances: input.ledgerBalances,
    quoteReads: input.quoteReads,
  });

  return createDealsModule({
    commandUow: new DrizzleDealsUnitOfWork({
      bindDocumentsReadModel: input.bindDocumentsReadModel,
      fundingAssessment,
      persistence,
    }),
    generateUuid: input.generateUuid ?? randomUUID,
    idempotency: input.idempotency,
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    reads: new DrizzleDealReads(
      input.db,
      currenciesQueries,
      partiesQueries,
      input.documentsReadModel,
      fundingAssessment,
    ),
    references: {
      async findAgreementById(id: string) {
        const agreement = await agreementReads.findById(id);

        if (!agreement) {
          return null;
        }

        return {
          currentVersionId: agreement.currentVersion.id,
          customerId: agreement.customerId,
          id: agreement.id,
          isActive: agreement.isActive,
          organizationId: agreement.organizationId,
        };
      },
      async findCalculationById(id: string) {
        const calculation = await calculationReads.findById(id);

        if (!calculation) {
          return null;
        }

        return {
          id: calculation.id,
          isActive: calculation.isActive,
        };
      },
      findCounterpartyById: counterpartyReads.findById.bind(counterpartyReads),
      async findCurrencyById(id: string) {
        return input.currencies.findById(id);
      },
      findCustomerById: customerReads.findById.bind(customerReads),
      async findQuoteById(id: string) {
        const quote = await input.quoteReads.findById(id);

        if (!quote) {
          return null;
        }

        return {
          agreementVersionId:
            quote.agreementVersionId ??
            quote.commercialTerms?.agreementVersionId ??
            null,
          dealId: quote.dealId,
          expiresAt: quote.expiresAt,
          id: quote.id,
          status: quote.status,
          usedAt: quote.usedAt,
          usedDocumentId: quote.usedDocumentId,
        };
      },
      async listActiveAgreementsByCustomerId(customerId: string) {
        const result = await agreementReads.list({
          customerId,
          isActive: true,
          limit: 10,
          offset: 0,
          sortBy: "createdAt",
          sortOrder: "desc",
        });

        return result.data.map((agreement) => ({
          currentVersionId: agreement.currentVersion.id,
          customerId: agreement.customerId,
          id: agreement.id,
          isActive: agreement.isActive,
          organizationId: agreement.organizationId,
        }));
      },
      validateSupportedCreateType(type) {
        if (
          ![
            "payment",
            "currency_exchange",
            "currency_transit",
            "exporter_settlement",
          ].includes(type)
        ) {
          throw new DealTypeNotSupportedError(type);
        }
      },
    },
  });
}
