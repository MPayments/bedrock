import { createHash, randomUUID } from "node:crypto";

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

  if (input.amountRef === "accepted_quote_customer_debit") {
    if (!input.acceptedQuote) {
      throw new ValidationError("Accepted quote details are required");
    }
    const customerDebitMinor = extractAcceptedQuoteCustomerDebitMinor(
      input.acceptedQuote,
    );
    return {
      amountMinor: customerDebitMinor,
      currencyId: input.acceptedQuote.quote.fromCurrencyId,
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

function deterministicUuid(seed: string): string {
  const bytes = createHash("sha256").update(seed).digest();
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

function routeParticipantPartyRef(
  participant:
    | DealPricingRouteAttachment["snapshot"]["participants"][number]
    | null,
): PaymentStepPartyRef | null {
  if (!participant?.entityId) {
    return null;
  }

  return {
    displayName: participant.displayName,
    entityKind: participant.entityKind,
    id: participant.entityId,
    requisiteId: participant.requisiteId ?? null,
  };
}

function partyRef(id: string | null): PaymentStepPartyRef | null {
  return id ? { id, requisiteId: null } : null;
}

function externalBeneficiarySnapshotPartyRef(
  workflow: DealWorkflowProjection,
): PaymentStepPartyRef | null {
  const beneficiary = workflow.intake.externalBeneficiary;

  if (beneficiary.beneficiaryCounterpartyId) {
    return null;
  }

  if (
    !beneficiary.beneficiarySnapshot &&
    !beneficiary.bankInstructionSnapshot
  ) {
    return null;
  }

  const displayName =
    beneficiary.beneficiarySnapshot?.displayName ??
    beneficiary.beneficiarySnapshot?.legalName ??
    beneficiary.bankInstructionSnapshot?.beneficiaryName ??
    beneficiary.bankInstructionSnapshot?.label ??
    "External beneficiary";

  return {
    displayName,
    entityKind: "external_beneficiary_snapshot",
    id: deterministicUuid(
      `deal:${workflow.summary.id}:external-beneficiary-snapshot`,
    ),
    requisiteId: null,
    snapshot: {
      bankInstructionSnapshot: beneficiary.bankInstructionSnapshot,
      beneficiarySnapshot: beneficiary.beneficiarySnapshot,
    },
  };
}

function resolveRouteParticipantPair(input: {
  compiled: CompiledDealExecutionOperation;
  routeAttachment: DealPricingRouteAttachment | null;
  workflow: DealWorkflowProjection;
}): {
  destParticipant:
    | DealPricingRouteAttachment["snapshot"]["participants"][number]
    | null;
  sourceParticipant:
    | DealPricingRouteAttachment["snapshot"]["participants"][number]
    | null;
} {
  const routeSnapshot = input.routeAttachment?.snapshot;

  if (!routeSnapshot) {
    return {
      destParticipant: null,
      sourceParticipant: null,
    };
  }

  const workflowLeg = input.workflow.executionPlan.find(
    (leg) => leg.id === input.compiled.legId,
  );
  const routeLegIndex = workflowLeg?.routeSnapshotLegId
    ? routeSnapshot.legs.findIndex(
        (leg) => leg.id === workflowLeg.routeSnapshotLegId,
      )
    : input.compiled.legIdx - 1;
  const participantIndex =
    routeLegIndex >= 0 ? routeLegIndex : input.compiled.legIdx - 1;

  return {
    destParticipant: routeSnapshot.participants[participantIndex + 1] ?? null,
    sourceParticipant: routeSnapshot.participants[participantIndex] ?? null,
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
  const applicant = pickEntityId("applicant");
  const beneficiary = pickEntityId("external_beneficiary");
  const beneficiarySnapshotParty = externalBeneficiarySnapshotPartyRef(
    input.workflow,
  );
  const { destParticipant, sourceParticipant } = resolveRouteParticipantPair(
    input,
  );

  let fromParty: PaymentStepPartyRef | null;
  let toParty: PaymentStepPartyRef | null;

  switch (input.compiled.legKind) {
    case "collect":
      fromParty =
        routeParticipantPartyRef(sourceParticipant) ?? partyRef(customer);
      toParty = routeParticipantPartyRef(destParticipant) ?? partyRef(internal);
      break;
    case "convert":
      fromParty =
        routeParticipantPartyRef(sourceParticipant) ?? partyRef(internal);
      toParty = routeParticipantPartyRef(destParticipant) ?? partyRef(internal);
      break;
    case "payout":
      fromParty =
        routeParticipantPartyRef(sourceParticipant) ??
        partyRef(internal);
      toParty =
        routeParticipantPartyRef(destParticipant) ??
        partyRef(beneficiary) ??
        beneficiarySnapshotParty ??
        partyRef(applicant);
      break;
    case "transit_hold":
      fromParty =
        routeParticipantPartyRef(sourceParticipant) ?? partyRef(internal);
      toParty =
        routeParticipantPartyRef(destParticipant) ??
        partyRef(
          input.compiled.operationKind === "intercompany_funding"
            ? (input.agreementOrganizationId ?? internal)
            : internal,
        );
      break;
    case "settle_exporter":
      fromParty =
        routeParticipantPartyRef(sourceParticipant) ?? partyRef(internal);
      toParty =
        routeParticipantPartyRef(destParticipant) ??
        partyRef(
          input.compiled.operationKind === "intercompany_funding"
            ? (input.agreementOrganizationId ?? internal)
            : beneficiary,
        ) ??
        beneficiarySnapshotParty ??
        partyRef(internal);
      break;
    default:
      return null;
  }

  if (!fromParty || !toParty) {
    return null;
  }

  return {
    fromParty,
    toParty,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractAcceptedQuoteCustomerDebitMinor(
  acceptedQuote: QuoteDetailsRecord,
): bigint {
  const metadata = asRecord(acceptedQuote.quote.pricingTrace?.metadata);
  const snapshot = asRecord(metadata?.crmPricingSnapshot);
  const amounts = asRecord(snapshot?.amounts);
  const customerDebitMinor = amounts?.customerDebitMinor;

  if (
    typeof customerDebitMinor !== "string" ||
    !/^[1-9]\d*$/u.test(customerDebitMinor)
  ) {
    throw new ValidationError(
      `Accepted quote ${acceptedQuote.quote.id} is missing customer debit pricing snapshot`,
    );
  }

  return BigInt(customerDebitMinor);
}

function isAcceptedQuoteTreasuryInventorySource(
  acceptedQuote: QuoteDetailsRecord | null,
): boolean {
  return extractAcceptedQuoteInventoryPositionId(acceptedQuote) !== null;
}

function extractAcceptedQuoteInventoryPositionId(
  acceptedQuote: QuoteDetailsRecord | null,
): string | null {
  const metadata = asRecord(acceptedQuote?.quote.pricingTrace?.metadata);
  const snapshot = asRecord(metadata?.crmPricingSnapshot);
  const executionSide = asRecord(snapshot?.executionSide);
  const source = executionSide?.source;
  const inventoryPositionId = executionSide?.inventoryPositionId;

  return source === "treasury_inventory" &&
    typeof inventoryPositionId === "string"
    ? inventoryPositionId
    : null;
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

function resolveQuoteRateParts(input: {
  acceptedQuote: QuoteDetailsRecord | null;
  compiled: CompiledDealExecutionOperation;
}): { rateDen: bigint; rateNum: bigint } {
  if (!input.acceptedQuote) {
    throw new ValidationError("Accepted quote details are required");
  }
  const quoteLeg =
    input.compiled.quoteLegIdx !== null
      ? input.acceptedQuote.legs.find(
          (leg) => leg.idx === input.compiled.quoteLegIdx,
        )
      : null;
  return {
    rateDen: quoteLeg?.rateDen ?? input.acceptedQuote.quote.rateDen,
    rateNum: quoteLeg?.rateNum ?? input.acceptedQuote.quote.rateNum,
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

  let partyRefs = resolveLegPartyRefs({
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

  const inventoryPositionId = extractAcceptedQuoteInventoryPositionId(
    input.acceptedQuote,
  );
  if (inventoryPositionId && input.compiled.operationKind === "payout") {
    const inventoryPosition =
      await input.treasuryModule.treasuryOrders.queries.findInventoryPositionById(
        { positionId: inventoryPositionId },
      );
    if (!inventoryPosition) {
      throw new ValidationError(
        `Treasury inventory position ${inventoryPositionId} is not available`,
      );
    }
    partyRefs = {
      ...partyRefs,
      fromParty: {
        id: inventoryPosition.ownerPartyId,
        requisiteId: inventoryPosition.ownerRequisiteId,
      },
    };
  }

  const rate = resolveStepRate({
    acceptedQuote: input.acceptedQuote,
    compiled: input.compiled,
  });

  const id = randomUUID();
  const routeSnapshotLegId =
    input.workflow.executionPlan.find((leg) => leg.id === input.compiled.legId)
      ?.routeSnapshotLegId ?? null;

  if (input.compiled.operationKind === "quote_execution") {
    if (isAcceptedQuoteTreasuryInventorySource(input.acceptedQuote)) {
      return null;
    }
    if (!input.compiled.quoteId) {
      throw new ValidationError(
        `Deal ${input.workflow.summary.id} convert leg ${input.compiled.legId} requires a quote`,
      );
    }
    if (amount.amountMinor === null || counterAmount.amountMinor === null) {
      throw new ValidationError(
        `Deal ${input.workflow.summary.id} convert leg ${input.compiled.legId} requires both quote amounts`,
      );
    }
    await input.treasuryModule.quoteExecutions.commands.create({
      dealId: input.workflow.summary.id,
      fromAmountMinor: amount.amountMinor,
      fromCurrencyId,
      id,
      initialState: "pending",
      origin: {
        dealId: input.workflow.summary.id,
        planLegId: input.compiled.legId,
        routeSnapshotLegId,
        sequence: input.compiled.legIdx,
        treasuryOrderId: null,
        type: "deal_execution_leg",
      },
      quoteId: input.compiled.quoteId,
      quoteLegIdx: input.compiled.quoteLegIdx,
      quoteSnapshot: null,
      ...resolveQuoteRateParts({
        acceptedQuote: input.acceptedQuote,
        compiled: input.compiled,
      }),
      executionParties: {
        creditParty: partyRefs.toParty,
        debitParty: partyRefs.fromParty,
      },
      sourceRef: input.compiled.sourceRef,
      toAmountMinor: counterAmount.amountMinor,
      toCurrencyId,
      treasuryOrderId: null,
    });

    return { id };
  }

  await input.treasuryModule.paymentSteps.commands.create({
    dealId: input.workflow.summary.id,
    fromAmountMinor: amount.amountMinor,
    fromCurrencyId,
    fromParty: partyRefs.fromParty,
    id,
    initialState: "draft",
    kind: input.compiled.operationKind,
    origin: {
      dealId: input.workflow.summary.id,
      planLegId: input.compiled.legId,
      routeSnapshotLegId,
      sequence: input.compiled.legIdx,
      treasuryOrderId: null,
      type: "deal_execution_leg",
    },
    planLegId: input.compiled.legId,
    purpose: "deal_leg",
    quoteId: input.compiled.quoteId,
    rate,
    routeSnapshotLegId,
    sequence: input.compiled.legIdx,
    sourceRef: input.compiled.sourceRef,
    toAmountMinor: counterAmount.amountMinor ?? amount.amountMinor,
    toCurrencyId,
    toParty: partyRefs.toParty,
    treasuryBatchId: null,
    treasuryOrderId: null,
  });

  return { id };
}

export async function resolveRecipeContext(
  deps: DealExecutionWorkflowDeps,
  dealsModule: {
    deals: {
      queries: {
        findPricingContextByDealId: (input: {
          dealId: string;
        }) => Promise<{ routeAttachment: DealPricingRouteAttachment | null }>;
      };
    };
  },
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
      routeAttachment: pricingContext?.routeAttachment ?? null,
      workflow,
    }),
  };
}
