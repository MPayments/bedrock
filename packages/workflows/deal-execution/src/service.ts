import { randomUUID } from "node:crypto";

import type { AgreementsModule } from "@bedrock/agreements";
import type { CurrenciesService } from "@bedrock/currencies";
import {
  DealNotFoundError,
  DealTransitionBlockedError,
  type DealsModule,
} from "@bedrock/deals";
import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import type { IdempotencyPort } from "@bedrock/platform/idempotency";
import type { Database, Transaction } from "@bedrock/platform/persistence";
import { ValidationError } from "@bedrock/shared/core/errors";
import { toMinorAmountString } from "@bedrock/shared/money";
import type { TreasuryModule } from "@bedrock/treasury";
import type {
  QuoteDetailsRecord,
  TreasuryOperationKind,
} from "@bedrock/treasury/contracts";

const DEAL_EXECUTION_REQUEST_SCOPE = "workflow-deal-execution.request";
const EXECUTION_REQUESTABLE_STATUSES = new Set([
  "awaiting_funds",
  "awaiting_payment",
  "closing_documents",
]);

export type DealExecutionAmountRef =
  | "accepted_quote_from"
  | "accepted_quote_to"
  | "incoming_receipt_expected"
  | "money_request_source";

export interface CompiledDealExecutionOperation {
  amountRef: DealExecutionAmountRef | null;
  counterAmountRef: DealExecutionAmountRef | null;
  legId: string;
  legIdx: number;
  legKind: DealWorkflowProjection["executionPlan"][number]["kind"];
  operationKind: TreasuryOperationKind;
  quoteId: string | null;
  sourceRef: string;
}

interface DealExecutionStore {
  createDealLegOperationLinks(input: {
    dealLegId: string;
    id: string;
    operationKind: TreasuryOperationKind;
    sourceRef: string;
    treasuryOperationId: string;
  }[]): Promise<void>;
  createDealTimelineEvents(input: {
    actorLabel: string | null;
    actorUserId: string | null;
    dealId: string;
    id: string;
    occurredAt: Date;
    payload: Record<string, unknown>;
    sourceRef: string | null;
    type: "execution_requested";
    visibility: "internal";
  }[]): Promise<void>;
}

export interface DealExecutionWorkflowDeps {
  agreements: Pick<AgreementsModule, "agreements">;
  currencies: Pick<CurrenciesService, "findById">;
  db: Database;
  idempotency: IdempotencyPort;
  createDealStore(tx: Transaction): DealExecutionStore;
  createDealsModule(tx: Transaction): Pick<DealsModule, "deals">;
  createTreasuryModule(tx: Transaction): Pick<TreasuryModule, "operations" | "quotes">;
}

function resolveFundingOperationKind(input: {
  agreementOrganizationId: string | null;
  internalEntityOrganizationId: string | null;
}): TreasuryOperationKind {
  if (
    input.agreementOrganizationId &&
    input.internalEntityOrganizationId &&
    input.agreementOrganizationId !== input.internalEntityOrganizationId
  ) {
    return "intercompany_funding";
  }

  return "intracompany_transfer";
}

function resolvePayoutAmountRef(workflow: DealWorkflowProjection): DealExecutionAmountRef {
  const hasConvert = workflow.executionPlan.some((leg) => leg.kind === "convert");

  if (
    hasConvert &&
    workflow.summary.type !== "exporter_settlement"
  ) {
    return "accepted_quote_to";
  }

  return "money_request_source";
}

export function compileDealExecutionRecipe(input: {
  acceptedQuote: QuoteDetailsRecord | null;
  agreementOrganizationId: string | null;
  internalEntityOrganizationId: string | null;
  workflow: DealWorkflowProjection;
}): CompiledDealExecutionOperation[] {
  const hasConvert = input.workflow.executionPlan.some(
    (leg) => leg.kind === "convert",
  );

  if (hasConvert && !input.acceptedQuote) {
    throw new ValidationError(
      `Deal ${input.workflow.summary.id} requires accepted quote details for execution`,
    );
  }

  return input.workflow.executionPlan.map((leg) => {
    if (!leg.id) {
      throw new ValidationError(
        `Deal ${input.workflow.summary.id} leg ${leg.idx}:${leg.kind} is missing an id`,
      );
    }

    let amountRef: DealExecutionAmountRef | null = null;
    let counterAmountRef: DealExecutionAmountRef | null = null;
    let operationKind: TreasuryOperationKind;
    let quoteId: string | null = null;

    switch (leg.kind) {
      case "collect":
        operationKind = "payin";
        amountRef =
          input.workflow.summary.type === "exporter_settlement"
            ? "incoming_receipt_expected"
            : "money_request_source";
        break;
      case "convert":
        operationKind = "fx_conversion";
        amountRef = "accepted_quote_from";
        counterAmountRef = "accepted_quote_to";
        quoteId = input.acceptedQuote?.quote.id ?? null;
        break;
      case "payout":
        operationKind = "payout";
        amountRef = resolvePayoutAmountRef(input.workflow);
        break;
      case "transit_hold":
      case "settle_exporter":
        operationKind = resolveFundingOperationKind({
          agreementOrganizationId: input.agreementOrganizationId,
          internalEntityOrganizationId: input.internalEntityOrganizationId,
        });
        amountRef =
          leg.kind === "settle_exporter"
            ? hasConvert
              ? "accepted_quote_to"
              : "incoming_receipt_expected"
            : hasConvert
              ? "accepted_quote_to"
              : "money_request_source";
        break;
    }

    return {
      amountRef,
      counterAmountRef,
      legId: leg.id,
      legIdx: leg.idx,
      legKind: leg.kind,
      operationKind,
      quoteId,
      sourceRef: `deal:${input.workflow.summary.id}:leg:${leg.idx}:${operationKind}:1`,
    };
  });
}

async function resolveAmountRef(input: {
  acceptedQuote: QuoteDetailsRecord | null;
  amountRef: DealExecutionAmountRef | null;
  currencyCodeById: Map<string, string>;
  currencies: DealExecutionWorkflowDeps["currencies"];
  workflow: DealWorkflowProjection;
}): Promise<{ amountMinor: bigint | null; currencyId: string | null }> {
  if (!input.amountRef) {
    return {
      amountMinor: null,
      currencyId: null,
    };
  }

  if (input.amountRef === "accepted_quote_from") {
    if (!input.acceptedQuote) {
      throw new ValidationError("Accepted quote details are required");
    }

    return {
      amountMinor: input.acceptedQuote.quote.fromAmountMinor,
      currencyId: input.acceptedQuote.quote.fromCurrencyId,
    };
  }

  if (input.amountRef === "accepted_quote_to") {
    if (!input.acceptedQuote) {
      throw new ValidationError("Accepted quote details are required");
    }

    return {
      amountMinor: input.acceptedQuote.quote.toAmountMinor,
      currencyId: input.acceptedQuote.quote.toCurrencyId,
    };
  }

  const rawAmount =
    input.amountRef === "money_request_source"
      ? input.workflow.intake.moneyRequest.sourceAmount
      : input.workflow.intake.incomingReceipt.expectedAmount;
  const currencyId =
    input.amountRef === "money_request_source"
      ? input.workflow.intake.moneyRequest.sourceCurrencyId
      : input.workflow.intake.incomingReceipt.expectedCurrencyId;

  if (!rawAmount || !currencyId) {
    return {
      amountMinor: null,
      currencyId: currencyId ?? null,
    };
  }

  let currencyCode = input.currencyCodeById.get(currencyId) ?? null;

  if (!currencyCode) {
    currencyCode = (await input.currencies.findById(currencyId)).code;
    input.currencyCodeById.set(currencyId, currencyCode);
  }

  return {
    amountMinor: BigInt(toMinorAmountString(rawAmount, currencyCode)),
    currencyId,
  };
}

function assertExecutionRequestAllowed(workflow: DealWorkflowProjection) {
  if (EXECUTION_REQUESTABLE_STATUSES.has(workflow.summary.status)) {
    return;
  }

  const readiness = workflow.transitionReadiness.find(
    (item) => item.targetStatus === "awaiting_funds",
  );

  if (readiness?.allowed) {
    return;
  }

  throw new DealTransitionBlockedError(
    "awaiting_funds",
    readiness?.blockers ?? [],
  );
}

export function createDealExecutionWorkflow(deps: DealExecutionWorkflowDeps) {
  return {
    async requestExecution(input: {
      actorUserId: string;
      comment?: string | null;
      dealId: string;
      idempotencyKey: string;
    }): Promise<DealWorkflowProjection> {
      return deps.db.transaction(async (tx) => {
        const dealsModule = deps.createDealsModule(tx);
        const dealStore = deps.createDealStore(tx);
        const treasuryModule = deps.createTreasuryModule(tx);

        return deps.idempotency.withIdempotencyTx({
          tx,
          scope: DEAL_EXECUTION_REQUEST_SCOPE,
          idempotencyKey: input.idempotencyKey,
          request: {
            comment: input.comment ?? null,
            dealId: input.dealId,
          },
          actorId: input.actorUserId,
          serializeResult: (result) => ({ dealId: result.summary.id }),
          loadReplayResult: async ({ storedResult }) => {
            const replayedDealId = String(storedResult?.dealId ?? input.dealId);
            const replayed = await dealsModule.deals.queries.findWorkflowById(
              replayedDealId,
            );

            if (!replayed) {
              throw new DealNotFoundError(replayedDealId);
            }

            return replayed;
          },
          handler: async () => {
            const workflow = await dealsModule.deals.queries.findWorkflowById(
              input.dealId,
            );

            if (!workflow) {
              throw new DealNotFoundError(input.dealId);
            }

            if (
              workflow.executionPlan.some((leg) => leg.operationRefs.length > 0)
            ) {
              return workflow;
            }

            assertExecutionRequestAllowed(workflow);

            const customerId =
              workflow.participants.find((participant) => participant.role === "customer")
                ?.customerId ?? null;
            const internalEntityOrganizationId =
              workflow.participants.find(
                (participant) => participant.role === "internal_entity",
              )?.organizationId ?? null;
            const agreement = await deps.agreements.agreements.queries.findById(
              workflow.summary.agreementId,
            );
            const acceptedQuote =
              workflow.executionPlan.some((leg) => leg.kind === "convert") &&
              workflow.acceptedQuote?.quoteId
                ? await treasuryModule.quotes.queries.getQuoteDetails({
                    quoteRef: workflow.acceptedQuote.quoteId,
                  })
                : null;
            const recipe = compileDealExecutionRecipe({
              acceptedQuote,
              agreementOrganizationId: agreement?.organizationId ?? null,
              internalEntityOrganizationId,
              workflow,
            });
            const currencyCodeById = new Map<string, string>();
            const now = new Date();
            const linkRows: Parameters<
              DealExecutionStore["createDealLegOperationLinks"]
            >[0] = [];

            for (const operation of recipe) {
              const amount = await resolveAmountRef({
                acceptedQuote,
                amountRef: operation.amountRef,
                currencies: deps.currencies,
                currencyCodeById,
                workflow,
              });
              const counterAmount = await resolveAmountRef({
                acceptedQuote,
                amountRef: operation.counterAmountRef,
                currencies: deps.currencies,
                currencyCodeById,
                workflow,
              });
              const created =
                await treasuryModule.operations.commands.createOrGetPlanned({
                  amountMinor: amount.amountMinor,
                  counterAmountMinor: counterAmount.amountMinor,
                  counterCurrencyId: counterAmount.currencyId,
                  currencyId: amount.currencyId,
                  customerId,
                  dealId: workflow.summary.id,
                  id: randomUUID(),
                  internalEntityOrganizationId,
                  kind: operation.operationKind,
                  quoteId: operation.quoteId,
                  sourceRef: operation.sourceRef,
                });

              linkRows.push({
                dealLegId: operation.legId,
                id: randomUUID(),
                operationKind: operation.operationKind,
                sourceRef: operation.sourceRef,
                treasuryOperationId: created.id,
              });
            }

            await dealStore.createDealLegOperationLinks(linkRows);
            await dealStore.createDealTimelineEvents([
              {
                actorLabel: null,
                actorUserId: input.actorUserId,
                dealId: workflow.summary.id,
                id: randomUUID(),
                occurredAt: now,
                payload: {
                  comment: input.comment ?? null,
                  operationCount: linkRows.length,
                },
                sourceRef: `execution:${workflow.summary.id}:request:${input.idempotencyKey}`,
                type: "execution_requested",
                visibility: "internal",
              },
            ]);

            const updated = await dealsModule.deals.queries.findWorkflowById(
              input.dealId,
            );

            if (!updated) {
              throw new DealNotFoundError(input.dealId);
            }

            return updated;
          },
        });
      });
    },
  };
}

export type DealExecutionWorkflow = ReturnType<
  typeof createDealExecutionWorkflow
>;
