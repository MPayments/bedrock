import { randomUUID } from "node:crypto";

import type { CurrenciesService } from "@bedrock/currencies";
import type { DealsModule } from "@bedrock/deals";
import type { LedgerModule } from "@bedrock/ledger";
import type {
  PersistenceContext,
  Transaction,
} from "@bedrock/platform/persistence";
import { ValidationError } from "@bedrock/shared/core/errors";
import type { TreasuryModule } from "@bedrock/treasury";
import type { DealCommercialWorkflow } from "@bedrock/workflow-deal-commercial";

import type { DealPricingWorkflow } from "./deal-pricing-workflow";
import type { DealQuoteWorkflow } from "./deal-quote-workflow";
import type { RequestContext } from "../middleware/request-context";

type DealPricingCreateQuoteInput = Parameters<
  DealPricingWorkflow["createQuote"]
>[0];
type CommitRoutePricingInput = Omit<
  DealPricingCreateQuoteInput,
  "dealId" | "idempotencyKey"
>;

export interface DealPricingCommitWorkflowDeps {
  currencies: Pick<CurrenciesService, "findById">;
  createDealsModule(tx: Transaction): DealsModule;
  createLedgerModule(tx: Transaction): LedgerModule;
  createTreasuryModule(tx: Transaction): TreasuryModule;
  dealCommercialWorkflow: Pick<
    DealCommercialWorkflow,
    "autoMaterializeAfterQuoteAccept"
  >;
  dealPricingWorkflow: DealPricingWorkflow;
  dealQuoteWorkflow: Pick<
    DealQuoteWorkflow,
    "createCalculationFromAcceptedQuote"
  >;
  dealsModule: Pick<DealsModule, "deals">;
  persistence: Pick<PersistenceContext, "runInTransaction">;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractInventoryReservation(input: {
  pricingTrace: Record<string, unknown> | null | undefined;
}): {
  amountMinor: bigint;
  positionId: string;
} | null {
  const pricingTrace = readRecord(input.pricingTrace);
  const metadata = readRecord(pricingTrace?.metadata);
  const snapshot = readRecord(metadata?.crmPricingSnapshot);
  const executionSide = readRecord(snapshot?.executionSide);
  const clientSide = readRecord(snapshot?.clientSide);

  if (
    executionSide?.source !== "treasury_inventory" ||
    typeof executionSide.inventoryPositionId !== "string" ||
    typeof clientSide?.beneficiaryAmountMinor !== "string"
  ) {
    return null;
  }

  return {
    amountMinor: BigInt(clientSide.beneficiaryAmountMinor),
    positionId: executionSide.inventoryPositionId,
  };
}

async function reserveInventoryForAcceptedQuote(input: {
  actorUserId: string;
  currencies: Pick<CurrenciesService, "findById">;
  dealId: string;
  idempotencyKey: string;
  ledgerModule: LedgerModule;
  quoteId: string;
  requestContext: RequestContext | undefined;
  treasuryModule: TreasuryModule;
}) {
  const quote = await input.treasuryModule.quotes.queries.findById(
    input.quoteId,
  );
  const reservation = extractInventoryReservation({
    pricingTrace: quote?.pricingTrace ?? null,
  });

  if (!reservation) {
    return null;
  }

  const existing =
    await input.treasuryModule.treasuryOrders.queries.findReservedAllocationByDealAndQuote(
      {
        dealId: input.dealId,
        quoteId: input.quoteId,
      },
    );
  if (existing) {
    return existing;
  }

  const position =
    await input.treasuryModule.treasuryOrders.queries.findInventoryPositionById(
      { positionId: reservation.positionId },
    );
  if (!position) {
    throw new ValidationError(
      `Treasury inventory position ${reservation.positionId} is not available`,
    );
  }

  const positionCurrency = await input.currencies.findById(position.currencyId);
  const currency = await input.ledgerModule.balances.queries.getBalance({
    bookId: position.ownerBookId,
    currency: positionCurrency.code,
    subjectId: position.ownerRequisiteId,
    subjectType: position.ledgerSubjectType,
  });
  const allocationId = randomUUID();
  const ledgerHoldRef = `treasury_inventory_allocation:${allocationId}`;
  await input.ledgerModule.balances.commands.reserve({
    actorId: input.actorUserId,
    amountMinor: reservation.amountMinor,
    holdRef: ledgerHoldRef,
    idempotencyKey: `${input.idempotencyKey}:inventory-balance-hold`,
    reason: `Reserve treasury inventory for deal ${input.dealId}`,
    requestContext: input.requestContext,
    subject: {
      bookId: currency.bookId,
      currency: currency.currency,
      subjectId: currency.subjectId,
      subjectType: currency.subjectType,
    },
  });

  return input.treasuryModule.treasuryOrders.commands.reserveInventoryAllocation(
    {
      amountMinor: reservation.amountMinor,
      dealId: input.dealId,
      id: allocationId,
      positionId: reservation.positionId,
      quoteId: input.quoteId,
    },
  );
}

async function releaseSupersededInventoryReservations(input: {
  actorUserId: string;
  currencies: Pick<CurrenciesService, "findById">;
  dealId: string;
  idempotencyKey: string;
  ledgerModule: LedgerModule;
  quoteId: string;
  requestContext: RequestContext | undefined;
  treasuryModule: TreasuryModule;
}) {
  const allocations =
    await input.treasuryModule.treasuryOrders.queries.listInventoryAllocations({
      dealId: input.dealId,
      limit: 100,
      offset: 0,
      state: "reserved",
    });

  for (const allocation of allocations.data) {
    if (allocation.quoteId === input.quoteId) {
      continue;
    }

    const currency = await input.currencies.findById(allocation.currencyId);
    await input.ledgerModule.balances.commands.release({
      actorId: input.actorUserId,
      holdRef: allocation.ledgerHoldRef,
      idempotencyKey: `${input.idempotencyKey}:inventory-balance-release:${allocation.id}`,
      reason: `Release superseded treasury inventory for deal ${input.dealId}`,
      requestContext: input.requestContext,
      subject: {
        bookId: allocation.ownerBookId,
        currency: currency.code,
        subjectId: allocation.ownerRequisiteId,
        subjectType: "organization_requisite",
      },
    });
    await input.treasuryModule.treasuryOrders.commands.releaseInventoryAllocation(
      {
        allocationId: allocation.id,
      },
    );
  }
}

export function createDealPricingCommitWorkflow(
  deps: DealPricingCommitWorkflowDeps,
) {
  async function acceptQuote(input: {
    actorUserId: string;
    dealId: string;
    quoteId: string;
    requestContext: RequestContext | undefined;
  }) {
    const result = await deps.persistence.runInTransaction(async (tx) => {
      const dealsModule = deps.createDealsModule(tx);
      const treasuryModule = deps.createTreasuryModule(tx);
      const ledgerModule = deps.createLedgerModule(tx);
      const accepted = await dealsModule.deals.commands.acceptQuote({
        actorUserId: input.actorUserId,
        dealId: input.dealId,
        quoteId: input.quoteId,
      });
      const acceptedQuoteId = accepted.acceptedQuote?.quoteId ?? input.quoteId;
      await releaseSupersededInventoryReservations({
        actorUserId: input.actorUserId,
        currencies: deps.currencies,
        dealId: input.dealId,
        idempotencyKey: `accept:${input.dealId}:${input.quoteId}`,
        ledgerModule,
        quoteId: acceptedQuoteId,
        requestContext: input.requestContext,
        treasuryModule,
      });
      await reserveInventoryForAcceptedQuote({
        actorUserId: input.actorUserId,
        currencies: deps.currencies,
        dealId: input.dealId,
        idempotencyKey: `accept:${input.dealId}:${input.quoteId}`,
        ledgerModule,
        quoteId: acceptedQuoteId,
        requestContext: input.requestContext,
        treasuryModule,
      });
      return accepted;
    });

    await deps.dealCommercialWorkflow.autoMaterializeAfterQuoteAccept({
      actorUserId: input.actorUserId,
      dealId: input.dealId,
      quoteId: result.acceptedQuote?.quoteId ?? input.quoteId,
    });

    return result;
  }

  async function commitRoutePricing(input: {
    actorUserId: string;
    dealId: string;
    idempotencyKey: string;
    pricing: CommitRoutePricingInput;
    requestContext: RequestContext | undefined;
  }) {
    const quoteResult = await deps.dealPricingWorkflow.createQuote({
      ...input.pricing,
      dealId: input.dealId,
      idempotencyKey: input.idempotencyKey,
    });

    await deps.dealsModule.deals.commands.appendTimelineEvent({
      actorUserId: input.actorUserId,
      dealId: input.dealId,
      payload: {
        expiresAt: quoteResult.quote.expiresAt,
        pricingMode: quoteResult.pricingMode,
        quoteId: quoteResult.quote.id,
      },
      sourceRef: `quote:${quoteResult.quote.id}:created`,
      type: "quote_created",
      visibility: "internal",
    });

    await deps.persistence.runInTransaction(async (tx) => {
      const dealsModule = deps.createDealsModule(tx);
      const treasuryModule = deps.createTreasuryModule(tx);
      const ledgerModule = deps.createLedgerModule(tx);
      await dealsModule.deals.commands.acceptQuote({
        actorUserId: input.actorUserId,
        dealId: input.dealId,
        quoteId: quoteResult.quote.id,
      });
      await releaseSupersededInventoryReservations({
        actorUserId: input.actorUserId,
        currencies: deps.currencies,
        dealId: input.dealId,
        idempotencyKey: input.idempotencyKey,
        ledgerModule,
        quoteId: quoteResult.quote.id,
        requestContext: input.requestContext,
        treasuryModule,
      });
      await reserveInventoryForAcceptedQuote({
        actorUserId: input.actorUserId,
        currencies: deps.currencies,
        dealId: input.dealId,
        idempotencyKey: input.idempotencyKey,
        ledgerModule,
        quoteId: quoteResult.quote.id,
        requestContext: input.requestContext,
        treasuryModule,
      });
    });

    const calculation =
      await deps.dealQuoteWorkflow.createCalculationFromAcceptedQuote({
        actorUserId: input.actorUserId,
        dealId: input.dealId,
        idempotencyKey: `${input.idempotencyKey}:calculation`,
        quoteId: quoteResult.quote.id,
      });

    await deps.dealCommercialWorkflow.autoMaterializeAfterQuoteAccept({
      actorUserId: input.actorUserId,
      dealId: input.dealId,
      quoteId: quoteResult.quote.id,
    });

    return { quoteResult, calculationId: calculation.id };
  }

  return {
    acceptQuote,
    commitRoutePricing,
  };
}

export type DealPricingCommitWorkflow = ReturnType<
  typeof createDealPricingCommitWorkflow
>;
