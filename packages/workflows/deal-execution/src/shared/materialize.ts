import { randomUUID } from "node:crypto";

import type {
  DealParticipantRole,
  DealPricingRouteAttachment,
  DealWorkflowProjection,
} from "@bedrock/deals/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";
import { toMinorAmountString } from "@bedrock/shared/money";
import type {
  PaymentStepPartyRef,
  PaymentStepRate,
  QuoteDetailsRecord,
} from "@bedrock/treasury/contracts";

import {
  compileDealExecutionRecipe,
  type CompiledDealExecutionOperation,
  type DealExecutionAmountRef,
} from "../recipe";
import type {
  DealExecutionStore,
  DealExecutionTreasuryModule,
  DealExecutionWorkflowDeps,
} from "./deps";
import { getInternalEntityOrganizationId } from "./workflow-helpers";

async function resolveAmountRef(input: {
  acceptedQuote: QuoteDetailsRecord | null;
  amountRef: DealExecutionAmountRef | null;
  currencyCodeById: Map<string, string>;
  currencies: DealExecutionWorkflowDeps["currencies"];
  quoteLegIdx: number | null;
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

  if (
    input.amountRef === "quote_leg_from" ||
    input.amountRef === "quote_leg_to"
  ) {
    if (!input.acceptedQuote) {
      throw new ValidationError("Accepted quote details are required");
    }
    if (input.quoteLegIdx === null) {
      throw new ValidationError(
        `${input.amountRef} requires a quoteLegIdx on the compiled operation`,
      );
    }
    const quoteLeg = input.acceptedQuote.legs.find(
      (leg) => leg.idx === input.quoteLegIdx,
    );
    if (!quoteLeg) {
      throw new ValidationError(
        `Accepted quote has no leg with idx ${input.quoteLegIdx}`,
      );
    }
    return input.amountRef === "quote_leg_from"
      ? {
          amountMinor: quoteLeg.fromAmountMinor,
          currencyId: quoteLeg.fromCurrencyId,
        }
      : {
          amountMinor: quoteLeg.toAmountMinor,
          currencyId: quoteLeg.toCurrencyId,
        };
  }

  const rawAmount =
    input.amountRef === "money_request_source"
      ? input.workflow.intake.moneyRequest.sourceAmount
      : input.workflow.intake.incomingReceipt.expectedAmount;
  const currencyId =
    input.amountRef === "money_request_source"
      ? input.workflow.intake.moneyRequest.sourceCurrencyId
      : input.workflow.intake.moneyRequest.targetCurrencyId;

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

export function resolveLegPartyRefs(input: {
  agreementOrganizationId: string | null;
  compiled: CompiledDealExecutionOperation;
  internalEntityOrganizationId: string | null;
  routeAttachment: DealPricingRouteAttachment | null;
  workflow: DealWorkflowProjection;
}): { fromParty: PaymentStepPartyRef; toParty: PaymentStepPartyRef } | null {
  const pickEntityId = (role: DealParticipantRole): string | null => {
    const participant = input.workflow.participants.find(
      (candidate) => candidate.role === role,
    );
    if (!participant) {
      return null;
    }
    return (
      participant.counterpartyId ??
      participant.customerId ??
      participant.organizationId
    );
  };

  const internal =
    input.internalEntityOrganizationId ?? pickEntityId("internal_entity");
  const customer = pickEntityId("customer") ?? pickEntityId("external_payer");
  const beneficiary =
    pickEntityId("external_beneficiary") ?? pickEntityId("applicant");

  const routeParticipants = input.routeAttachment?.snapshot.participants ?? [];
  const sourceParticipant = routeParticipants[input.compiled.legIdx - 1] ?? null;
  const destParticipant = routeParticipants[input.compiled.legIdx] ?? null;

  let fromPartyId: string | null;
  let toPartyId: string | null;

  switch (input.compiled.legKind) {
    case "collect":
      fromPartyId = sourceParticipant?.entityId ?? customer;
      toPartyId = destParticipant?.entityId ?? internal;
      break;
    case "convert":
      fromPartyId = sourceParticipant?.entityId ?? internal;
      toPartyId = destParticipant?.entityId ?? internal;
      break;
    case "payout":
      fromPartyId = sourceParticipant?.entityId ?? internal;
      toPartyId = destParticipant?.entityId ?? beneficiary;
      break;
    case "transit_hold":
      fromPartyId = sourceParticipant?.entityId ?? internal;
      toPartyId =
        destParticipant?.entityId ??
        (input.compiled.operationKind === "intercompany_funding"
          ? (input.agreementOrganizationId ?? internal)
          : internal);
      break;
    case "settle_exporter":
      fromPartyId = sourceParticipant?.entityId ?? internal;
      toPartyId =
        destParticipant?.entityId ??
        (input.compiled.operationKind === "intercompany_funding"
          ? (input.agreementOrganizationId ?? internal)
          : (beneficiary ?? internal));
      break;
    default:
      return null;
  }

  if (!fromPartyId || !toPartyId) {
    return null;
  }

  return {
    fromParty: {
      id: fromPartyId,
      requisiteId: sourceParticipant?.requisiteId ?? null,
    },
    toParty: {
      id: toPartyId,
      requisiteId: destParticipant?.requisiteId ?? null,
    },
  };
}

function resolveStepRate(input: {
  acceptedQuote: QuoteDetailsRecord | null;
  compiled: CompiledDealExecutionOperation;
}): PaymentStepRate | null {
  if (input.compiled.legKind !== "convert" || !input.acceptedQuote) {
    return null;
  }
  const quoteLeg =
    input.compiled.quoteLegIdx !== null
      ? input.acceptedQuote.legs.find(
          (leg) => leg.idx === input.compiled.quoteLegIdx,
        )
      : null;
  const rateNum = quoteLeg?.rateNum ?? input.acceptedQuote.quote.rateNum;
  const rateDen = quoteLeg?.rateDen ?? input.acceptedQuote.quote.rateDen;
  if (rateNum === null || rateDen === null || rateDen === 0n) {
    return null;
  }
  const scale = 100_000_000n;
  const scaled = (rateNum * scale) / rateDen;
  const integerPart = scaled / scale;
  const fractionPart = scaled % scale;
  const fractionStr = fractionPart
    .toString()
    .padStart(8, "0")
    .replace(/0+$/, "");
  const value = fractionStr
    ? `${integerPart.toString()}.${fractionStr}`
    : integerPart.toString();
  return { value, lockedSide: "in" };
}

export async function materializeCompiledOperation(input: {
  acceptedQuote: QuoteDetailsRecord | null;
  agreementOrganizationId: string | null;
  compiled: CompiledDealExecutionOperation;
  currencies: DealExecutionWorkflowDeps["currencies"];
  currencyCodeById: Map<string, string>;
  customerId: string | null;
  dealStore: DealExecutionStore;
  internalEntityOrganizationId: string | null;
  routeAttachment: DealPricingRouteAttachment | null;
  treasuryModule: DealExecutionTreasuryModule;
  workflow: DealWorkflowProjection;
}): Promise<{ id: string } | null> {
  const amount = await resolveAmountRef({
    acceptedQuote: input.acceptedQuote,
    amountRef: input.compiled.amountRef,
    currencies: input.currencies,
    currencyCodeById: input.currencyCodeById,
    quoteLegIdx: input.compiled.quoteLegIdx,
    workflow: input.workflow,
  });
  const counterAmount = await resolveAmountRef({
    acceptedQuote: input.acceptedQuote,
    amountRef: input.compiled.counterAmountRef,
    currencies: input.currencies,
    currencyCodeById: input.currencyCodeById,
    quoteLegIdx: input.compiled.quoteLegIdx,
    workflow: input.workflow,
  });

  const partyRefs = resolveLegPartyRefs({
    agreementOrganizationId: input.agreementOrganizationId,
    compiled: input.compiled,
    internalEntityOrganizationId: input.internalEntityOrganizationId,
    routeAttachment: input.routeAttachment,
    workflow: input.workflow,
  });
  const fromCurrencyId = amount.currencyId;
  const toCurrencyId = counterAmount.currencyId ?? amount.currencyId;

  if (!partyRefs || !fromCurrencyId || !toCurrencyId) {
    return null;
  }

  const rate = resolveStepRate({
    acceptedQuote: input.acceptedQuote,
    compiled: input.compiled,
  });

  const id = randomUUID();
  await input.treasuryModule.paymentSteps.commands.create({
    dealId: input.workflow.summary.id,
    dealLegIdx: input.compiled.legIdx,
    dealLegRole: input.compiled.legKind,
    fromAmountMinor: amount.amountMinor,
    fromCurrencyId,
    fromParty: partyRefs.fromParty,
    id,
    initialState: "draft",
    kind: input.compiled.operationKind,
    purpose: "deal_leg",
    rate,
    toAmountMinor: counterAmount.amountMinor ?? amount.amountMinor,
    toCurrencyId,
    toParty: partyRefs.toParty,
    treasuryBatchId: null,
  });

  return { id };
}

export async function resolveRecipeContext(
  deps: DealExecutionWorkflowDeps,
  dealsModule: { deals: { queries: { findPricingContextByDealId: (input: { dealId: string }) => Promise<{ routeAttachment: DealPricingRouteAttachment | null }> } } },
  treasuryModule: DealExecutionTreasuryModule,
  workflow: DealWorkflowProjection,
) {
  const [agreement, pricingContext] = await Promise.all([
    deps.agreements.agreements.queries.findById(workflow.summary.agreementId),
    dealsModule.deals.queries
      .findPricingContextByDealId({ dealId: workflow.summary.id })
      .catch(() => null),
  ]);
  const acceptedQuote =
    workflow.executionPlan.some((leg) => leg.kind === "convert") &&
    workflow.acceptedQuote?.quoteId
      ? await treasuryModule.quotes.queries.getQuoteDetails({
          quoteRef: workflow.acceptedQuote.quoteId,
        })
      : null;

  return {
    acceptedQuote,
    agreementOrganizationId: agreement?.organizationId ?? null,
    internalEntityOrganizationId: getInternalEntityOrganizationId(workflow),
    routeAttachment: pricingContext?.routeAttachment ?? null,
    recipe: compileDealExecutionRecipe({
      acceptedQuote,
      agreementOrganizationId: agreement?.organizationId ?? null,
      internalEntityOrganizationId: getInternalEntityOrganizationId(workflow),
      workflow,
    }),
  };
}
