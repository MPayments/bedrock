import { randomUUID } from "node:crypto";

import { DrizzleAgreementReads } from "@bedrock/agreements/adapters/drizzle";
import { DrizzleCalculationReads } from "@bedrock/calculations/adapters/drizzle";
import type { CurrenciesService } from "@bedrock/currencies";
import { createCurrenciesQueries } from "@bedrock/currencies/queries";
import {
  createDealsModule,
  DealTypeNotSupportedError,
  type DealsModule,
  type DealsModuleDeps,
} from "@bedrock/deals";
import {
  DrizzleDealReads,
  DrizzleDealsUnitOfWork,
} from "@bedrock/deals/adapters/drizzle";
import { createDrizzleDocumentsReadModel } from "@bedrock/documents/read-model";
import type { OrganizationRequisiteLiquidityQueryRow } from "@bedrock/ledger/contracts";
import { DrizzleCounterpartyReads, DrizzleCustomerReads } from "@bedrock/parties/adapters/drizzle";
import { createPartiesQueries } from "@bedrock/parties/queries";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Logger } from "@bedrock/platform/observability/logger";
import {
  createPersistenceContext,
  type Database,
  type PersistenceContext,
} from "@bedrock/platform/persistence";
import type {
  PaymentRouteDraft,
  QuoteDetailsRecord,
} from "@bedrock/treasury/contracts";

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
    getQuoteDetails(input: {
      quoteRef: string;
    }): Promise<QuoteDetailsRecord>;
  };
}) {
  return {
    async assessFunding(inputParams: {
      acceptedQuoteId: string | null;
      hasConvertLeg: boolean;
      internalEntityOrganizationId: string | null;
      targetCurrencyId: string | null;
    }) {
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

      let quoteDetails: QuoteDetailsRecord;

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

export function createApiDealsModule(input: {
  currencies: Pick<CurrenciesService, "findById">;
  db: Database;
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
  paymentRouteTemplates?: {
    findById(id: string): Promise<{
      draft: PaymentRouteDraft;
      id: string;
      name: string;
    } | null>;
  };
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
    getQuoteDetails(input: {
      quoteRef: string;
    }): Promise<QuoteDetailsRecord>;
  };
}): DealsModule {
  const customerReads = new DrizzleCustomerReads(input.db);
  const counterpartyReads = new DrizzleCounterpartyReads(input.db);
  const calculationReads = new DrizzleCalculationReads(input.db);
  const persistence = input.persistence ?? createPersistenceContext(input.db);
  const currenciesQueries = createCurrenciesQueries({ db: input.db });
  const partiesQueries = createPartiesQueries({ db: input.db });
  const documentsReadModel = createDrizzleDocumentsReadModel({ db: input.db });
  const fundingAssessment = createDealFundingAssessmentPort({
    currencies: input.currencies,
    ledgerBalances: input.ledgerBalances,
    quoteReads: input.quoteReads,
  });
  const agreementReadsWithCurrencies = new DrizzleAgreementReads(
    input.db,
    currenciesQueries,
  );

  return createDealsModule({
    logger: input.logger,
    now: input.now ?? (() => new Date()),
    generateUuid: input.generateUuid ?? randomUUID,
    idempotency: input.idempotency,
    reads: new DrizzleDealReads(
      input.db,
      currenciesQueries,
      partiesQueries,
      documentsReadModel,
      fundingAssessment,
    ),
    references: {
      async findAgreementById(id: string) {
        const agreement = await agreementReadsWithCurrencies.findById(id);
        if (!agreement) {
          return null;
        }

        return {
          currentVersionId: agreement.currentVersion.id,
          id: agreement.id,
          customerId: agreement.customerId,
          organizationId: agreement.organizationId,
          isActive: agreement.isActive,
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
      async findCounterpartyById(id: string) {
        return counterpartyReads.findById(id);
      },
      async findCurrencyById(id: string) {
        return input.currencies.findById(id);
      },
      async findCustomerById(id: string) {
        return customerReads.findById(id);
      },
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
      async findPaymentRouteTemplateById(id: string) {
        const template = await input.paymentRouteTemplates?.findById(id);
        if (!template) {
          return null;
        }
        return {
          id: template.id,
          name: template.name,
          snapshot: template.draft,
        };
      },
      async listActiveAgreementsByCustomerId(customerId: string) {
        const result = await agreementReadsWithCurrencies.list({
          customerId,
          isActive: true,
          limit: 10,
          offset: 0,
          sortBy: "createdAt",
          sortOrder: "desc",
        });

        return result.data.map((agreement) => ({
          currentVersionId: agreement.currentVersion.id,
          id: agreement.id,
          customerId: agreement.customerId,
          organizationId: agreement.organizationId,
          isActive: agreement.isActive,
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
    commandUow: new DrizzleDealsUnitOfWork({
      bindDocumentsReadModel: (db) => createDrizzleDocumentsReadModel({ db }),
      fundingAssessment,
      persistence,
    }),
  });
}
