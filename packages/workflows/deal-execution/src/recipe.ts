import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";
import type {
  PaymentStepKind,
  QuoteDetailsRecord,
} from "@bedrock/treasury/contracts";

export type DealExecutionAmountRef =
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
  operationKind: PaymentStepKind;
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

function resolvePayoutAmountRef(
  workflow: DealWorkflowProjection,
): DealExecutionAmountRef {
  const hasConvert = workflow.executionPlan.some(
    (leg) => leg.kind === "convert",
  );

  if (hasConvert && workflow.summary.type !== "exporter_settlement") {
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

  const routeDerivedLegIds = new Set(
    input.workflow.executionPlan
      .filter(
        (leg) =>
          Boolean(leg.routeSnapshotLegId) &&
          (leg.kind === "convert" || leg.kind === "transit_hold"),
      )
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
      let operationKind: PaymentStepKind;
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
          amountRef =
            input.workflow.summary.type === "exporter_settlement"
              ? "incoming_receipt_expected"
              : hasConvert && input.acceptedQuote
                ? "accepted_quote_from"
                : "money_request_source";
          break;
        case "convert":
          operationKind = "fx_conversion";
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
          amountRef = resolvePayoutAmountRef(input.workflow);
          break;
        case "transit_hold":
          operationKind = resolveFundingOperationKind({
            agreementOrganizationId: input.agreementOrganizationId,
            internalEntityOrganizationId: input.internalEntityOrganizationId,
          });
          if (isRouteDerived) {
            amountRef = "quote_leg_to";
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
