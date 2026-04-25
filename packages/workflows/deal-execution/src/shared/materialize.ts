import { randomUUID } from "node:crypto";

import type {
  DealParticipantRole,
  DealWorkflowProjection,
} from "@bedrock/deals/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";
import { toMinorAmountString } from "@bedrock/shared/money";
import type {
  PaymentStepPartyRef,
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

  let fromPartyId: string | null;
  let toPartyId: string | null;

  switch (input.compiled.legKind) {
    case "collect":
      fromPartyId = customer;
      toPartyId = internal;
      break;
    case "convert":
      fromPartyId = internal;
      toPartyId = internal;
      break;
    case "payout":
      fromPartyId = internal;
      toPartyId = beneficiary;
      break;
    case "transit_hold":
      fromPartyId = internal;
      toPartyId =
        input.compiled.operationKind === "intercompany_funding"
          ? (input.agreementOrganizationId ?? internal)
          : internal;
      break;
    case "settle_exporter":
      fromPartyId = internal;
      toPartyId =
        input.compiled.operationKind === "intercompany_funding"
          ? (input.agreementOrganizationId ?? internal)
          : (beneficiary ?? internal);
      break;
    default:
      return null;
  }

  if (!fromPartyId || !toPartyId) {
    return null;
  }

  return {
    fromParty: { id: fromPartyId, requisiteId: null },
    toParty: { id: toPartyId, requisiteId: null },
  };
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
    workflow: input.workflow,
  });
  const fromCurrencyId = amount.currencyId;
  const toCurrencyId = counterAmount.currencyId ?? amount.currencyId;

  if (!partyRefs || !fromCurrencyId || !toCurrencyId) {
    return null;
  }

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
    rate: null,
    toAmountMinor: counterAmount.amountMinor ?? amount.amountMinor,
    toCurrencyId,
    toParty: partyRefs.toParty,
    treasuryBatchId: null,
  });

  return { id };
}

export async function resolveRecipeContext(
  deps: DealExecutionWorkflowDeps,
  treasuryModule: DealExecutionTreasuryModule,
  workflow: DealWorkflowProjection,
) {
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

  return {
    acceptedQuote,
    agreementOrganizationId: agreement?.organizationId ?? null,
    internalEntityOrganizationId: getInternalEntityOrganizationId(workflow),
    recipe: compileDealExecutionRecipe({
      acceptedQuote,
      agreementOrganizationId: agreement?.organizationId ?? null,
      internalEntityOrganizationId: getInternalEntityOrganizationId(workflow),
      workflow,
    }),
  };
}
