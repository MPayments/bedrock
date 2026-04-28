import type {
  DealPricingRouteAttachment,
  DealWorkflowProjection,
} from "@bedrock/deals/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";
import type {
  PaymentStepKind,
  QuoteDetailsRecord,
} from "@bedrock/treasury/contracts";

export type DealExecutionAmountRef =
  | "accepted_quote_customer_debit"
  | "accepted_quote_from"
  | "accepted_quote_to"
  | "incoming_receipt_expected"
  | "money_request_source"
  | "quote_leg_from"
  | "quote_leg_to";

export interface CompiledDealExecutionOperation {
  amountRef: DealExecutionAmountRef | null;
  counterAmountRef: DealExecutionAmountRef | null;
  legId: string;
  legIdx: number;
  legKind: DealWorkflowProjection["executionPlan"][number]["kind"];
  operationKind: PaymentStepKind | "quote_execution";
  quoteId: string | null;
  quoteLegIdx: number | null;
  sourceRef: string;
}

function resolveFundingOperationKind(input: {
  agreementOrganizationId: string | null;
  internalEntityOrganizationId: string | null;
}): PaymentStepKind {
  if (
    input.agreementOrganizationId &&
    input.internalEntityOrganizationId &&
    input.agreementOrganizationId !== input.internalEntityOrganizationId
  ) {
    return "intercompany_funding";
  }

  return "intracompany_transfer";
}

function resolveRouteDerivedFundingOperationKind(input: {
  agreementOrganizationId: string | null;
  internalEntityOrganizationId: string | null;
  leg: DealWorkflowProjection["executionPlan"][number];
  routeAttachment: DealPricingRouteAttachment | null;
}): PaymentStepKind {
  const fallback = resolveFundingOperationKind({
    agreementOrganizationId: input.agreementOrganizationId,
    internalEntityOrganizationId: input.internalEntityOrganizationId,
  });
  const routeSnapshot = input.routeAttachment?.snapshot;

  if (!routeSnapshot || !input.leg.routeSnapshotLegId) {
    return fallback;
  }

  const routeLegIndex = routeSnapshot.legs.findIndex(
    (leg) => leg.id === input.leg.routeSnapshotLegId,
  );

  if (routeLegIndex < 0) {
    return fallback;
  }

  const fromParticipant = routeSnapshot.participants[routeLegIndex] ?? null;
  const toParticipant = routeSnapshot.participants[routeLegIndex + 1] ?? null;

  if (
    fromParticipant?.binding !== "bound" ||
    toParticipant?.binding !== "bound" ||
    fromParticipant.entityKind !== "organization" ||
    toParticipant.entityKind !== "organization"
  ) {
    return fallback;
  }

  return fromParticipant.entityId === toParticipant.entityId
    ? "intracompany_transfer"
    : "intercompany_funding";
}

function resolvePayoutAmountRef(
  workflow: DealWorkflowProjection,
): DealExecutionAmountRef {
  if (workflow.summary.type === "payment") {
    return "incoming_receipt_expected";
  }

  const hasConvert = workflow.executionPlan.some(
    (leg) => leg.kind === "convert",
  );

  if (hasConvert && workflow.summary.type !== "exporter_settlement") {
    return "accepted_quote_to";
  }

  return "money_request_source";
}

function isCrossCurrencyQuoteLeg(input: {
  acceptedQuote: QuoteDetailsRecord | null;
  quoteLegIdx: number | null;
}): boolean {
  if (!input.acceptedQuote || input.quoteLegIdx === null) {
    return false;
  }
  const quoteLeg = input.acceptedQuote.legs.find(
    (leg) => leg.idx === input.quoteLegIdx,
  );
  return Boolean(
    quoteLeg && quoteLeg.fromCurrencyId !== quoteLeg.toCurrencyId,
  );
}

export function compileDealExecutionRecipe(input: {
  acceptedQuote: QuoteDetailsRecord | null;
  agreementOrganizationId: string | null;
  internalEntityOrganizationId: string | null;
  routeAttachment?: DealPricingRouteAttachment | null;
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

  const routeDerivedLegIds = new Set(
    input.workflow.executionPlan
      .filter((leg) => Boolean(input.acceptedQuote && leg.routeSnapshotLegId))
      .map((leg) => leg.id),
  );
  const quoteLegCount = input.acceptedQuote?.legs.length ?? 0;
  let quoteLegCursor = 0;

  return input.workflow.executionPlan
    .filter((leg) => leg.state !== "skipped")
    .map((leg) => {
      if (!leg.id) {
        throw new ValidationError(
          `Deal ${input.workflow.summary.id} leg ${leg.idx}:${leg.kind} is missing an id`,
        );
      }

      let amountRef: DealExecutionAmountRef | null = null;
      let counterAmountRef: DealExecutionAmountRef | null = null;
      let operationKind: PaymentStepKind | "quote_execution";
      let quoteId: string | null = null;
      let quoteLegIdx: number | null = null;

      const isRouteDerived = routeDerivedLegIds.has(leg.id);
      if (isRouteDerived) {
        quoteLegCursor += 1;
        if (quoteLegCursor > quoteLegCount) {
          throw new ValidationError(
            `Deal ${input.workflow.summary.id} has more route-derived legs than the accepted quote provides (leg ${leg.idx}:${leg.kind} would need quote leg ${quoteLegCursor}, quote has ${quoteLegCount})`,
          );
        }
        quoteLegIdx = quoteLegCursor;
      }

      switch (leg.kind) {
        case "collect":
          operationKind = "payin";
          if (isRouteDerived) {
            amountRef = "quote_leg_from";
            counterAmountRef = "quote_leg_to";
          } else {
            amountRef =
              input.workflow.summary.type === "payment"
                ? hasConvert && input.acceptedQuote
                  ? "accepted_quote_customer_debit"
                  : "incoming_receipt_expected"
                : input.workflow.summary.type === "exporter_settlement"
                  ? "incoming_receipt_expected"
                  : hasConvert && input.acceptedQuote
                    ? "accepted_quote_from"
                    : "money_request_source";
          }
          break;
        case "convert":
          operationKind = "quote_execution";
          quoteId = input.acceptedQuote?.quote.id ?? null;
          if (isRouteDerived) {
            amountRef = "quote_leg_from";
            counterAmountRef = "quote_leg_to";
          } else {
            amountRef = "accepted_quote_from";
            counterAmountRef = "accepted_quote_to";
          }
          break;
        case "payout":
          operationKind = "payout";
          if (isRouteDerived) {
            amountRef = "quote_leg_from";
            counterAmountRef = "quote_leg_to";
            if (
              isCrossCurrencyQuoteLeg({
                acceptedQuote: input.acceptedQuote,
                quoteLegIdx,
              })
            ) {
              quoteId = input.acceptedQuote?.quote.id ?? null;
            }
          } else {
            amountRef = resolvePayoutAmountRef(input.workflow);
          }
          break;
        case "transit_hold":
          operationKind = resolveRouteDerivedFundingOperationKind({
            agreementOrganizationId: input.agreementOrganizationId,
            internalEntityOrganizationId: input.internalEntityOrganizationId,
            leg,
            routeAttachment: input.routeAttachment ?? null,
          });
          if (isRouteDerived) {
            amountRef = "quote_leg_from";
            counterAmountRef = "quote_leg_to";
          } else {
            amountRef = hasConvert
              ? "accepted_quote_to"
              : "money_request_source";
          }
          break;
        case "settle_exporter":
          operationKind = resolveFundingOperationKind({
            agreementOrganizationId: input.agreementOrganizationId,
            internalEntityOrganizationId: input.internalEntityOrganizationId,
          });
          amountRef = hasConvert
            ? "accepted_quote_to"
            : "incoming_receipt_expected";
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
        quoteLegIdx,
        sourceRef: `deal:${input.workflow.summary.id}:plan-leg:${leg.id}:${operationKind}:1`,
      };
    });
}
