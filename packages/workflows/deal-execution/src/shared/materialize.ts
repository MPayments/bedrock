import { randomUUID } from "node:crypto";

import type { DealWorkflowProjection } from "@bedrock/deals/contracts";
import { ValidationError } from "@bedrock/shared/core/errors";
import { toMinorAmountString } from "@bedrock/shared/money";
import type { TreasuryModule } from "@bedrock/treasury";
import type { QuoteDetailsRecord } from "@bedrock/treasury/contracts";

import {
  compileDealExecutionRecipe,
  type CompiledDealExecutionOperation,
  type DealExecutionAmountRef,
} from "../recipe";
import type {
  DealExecutionStore,
  DealExecutionWorkflowDeps,
} from "./deps";
import { getInternalEntityOrganizationId } from "./workflow-helpers";

export async function resolveAmountRef(input: {
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

export async function materializeCompiledOperation(input: {
  acceptedQuote: QuoteDetailsRecord | null;
  compiled: CompiledDealExecutionOperation;
  currencies: DealExecutionWorkflowDeps["currencies"];
  currencyCodeById: Map<string, string>;
  customerId: string | null;
  dealStore: DealExecutionStore;
  internalEntityOrganizationId: string | null;
  treasuryModule: Pick<
    TreasuryModule,
    "instructions" | "operations" | "quotes"
  >;
  workflow: DealWorkflowProjection;
}) {
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
  const created =
    await input.treasuryModule.operations.commands.createOrGetPlanned({
      amountMinor: amount.amountMinor,
      counterAmountMinor: counterAmount.amountMinor,
      counterCurrencyId: counterAmount.currencyId,
      currencyId: amount.currencyId,
      customerId: input.customerId,
      dealId: input.workflow.summary.id,
      id: randomUUID(),
      internalEntityOrganizationId: input.internalEntityOrganizationId,
      kind: input.compiled.operationKind,
      quoteId: input.compiled.quoteId,
      sourceRef: input.compiled.sourceRef,
    });

  await input.dealStore.createDealLegOperationLinks([
    {
      dealLegId: input.compiled.legId,
      id: randomUUID(),
      operationKind: input.compiled.operationKind,
      sourceRef: input.compiled.sourceRef,
      treasuryOperationId: created.id,
    },
  ]);

  return created;
}

export async function resolveRecipeContext(
  deps: DealExecutionWorkflowDeps,
  treasuryModule: Pick<
    TreasuryModule,
    "instructions" | "operations" | "quotes"
  >,
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
