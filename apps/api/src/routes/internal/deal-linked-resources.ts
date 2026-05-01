import { z } from "@hono/zod-openapi";

import {
  canDealCreateFormalDocuments,
  canDealWriteTreasuryOrFormalDocuments,
} from "@bedrock/deals";
import type { DealDetails, DealTrace } from "@bedrock/deals/contracts";
import { DealTraceSchema } from "@bedrock/deals/contracts";
import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";
import { minorToAmountString } from "@bedrock/shared/money";
import type { QuotePreviewRecord } from "@bedrock/treasury/contracts";
import { resolveDealInvoiceBillingSelection } from "@bedrock/workflow-deal-projections";

import {
  extractAgreementCommercialDefaults,
  normalizeOptionalDecimalString,
} from "../../composition/commercial-pricing";
import type { AppContext } from "../../context";

export const DealScopedCreateDocumentInputSchema = z.object({
  dealId: z.string().uuid().optional(),
  input: z.unknown(),
});

export type DealScopedCreateDocumentInput = z.infer<
  typeof DealScopedCreateDocumentInputSchema
>;

export async function requireDeal(ctx: AppContext, dealId: string) {
  const deal = await ctx.dealsModule.deals.queries.findById(dealId);

  if (!deal) {
    throw new NotFoundError("Deal", dealId);
  }

  return deal;
}

export async function triggerAutoMaterializeAfterAccept(
  ctx: AppContext,
  input: { actorUserId: string; dealId: string; quoteId: string },
): Promise<void> {
  try {
    await ctx.dealExecutionWorkflow.requestExecution({
      actorUserId: input.actorUserId,
      comment: null,
      dealId: input.dealId,
      idempotencyKey: `auto-materialize:${input.quoteId}`,
    });
  } catch (materializeError) {
    ctx.logger.warn("auto-materialize after accept-quote failed", {
      dealId: input.dealId,
      error:
        materializeError instanceof Error
          ? materializeError.message
          : String(materializeError),
      quoteId: input.quoteId,
    });

    try {
      await ctx.dealsModule.deals.commands.appendTimelineEvent({
        actorUserId: input.actorUserId,
        dealId: input.dealId,
        payload: {
          quoteId: input.quoteId,
          reason:
            materializeError instanceof Error
              ? materializeError.message
              : String(materializeError),
        },
        sourceRef: `materialize:auto:${input.quoteId}`,
        type: "materialization_failed",
        visibility: "internal",
      });
    } catch (timelineError) {
      ctx.logger.warn(
        "failed to append materialization_failed timeline event",
        {
          dealId: input.dealId,
          error:
            timelineError instanceof Error
              ? timelineError.message
              : String(timelineError),
        },
      );
    }
  }
}

export function assertDealAllowsCommercialWrite(deal: DealDetails) {
  if (
    !canDealWriteTreasuryOrFormalDocuments({
      status: deal.status,
      type: deal.type,
    })
  ) {
    throw new ValidationError(
      `Deal ${deal.id} cannot start treasury quotes or formal documents from status ${deal.status}`,
    );
  }
}

function assertDealAllowsFormalDocumentCreate(deal: DealDetails) {
  if (
    !canDealCreateFormalDocuments({
      status: deal.status,
      type: deal.type,
    })
  ) {
    throw new ValidationError(
      `Deal ${deal.id} cannot create formal documents from status ${deal.status}; formal documents are available from status preparing_documents onwards`,
    );
  }
}

export async function createDealScopedQuote(input: {
  body: any;
  ctx: AppContext;
  dealId: string;
  idempotencyKey: string;
}) {
  const quoteInput = await buildDealScopedQuoteInput(input);
  type CreateQuoteInput = Parameters<
    AppContext["treasuryModule"]["quotes"]["commands"]["createQuote"]
  >[0];

  const createQuoteInput: CreateQuoteInput = {
    ...(quoteInput as CreateQuoteInput),
    dealId: input.dealId,
    idempotencyKey: input.idempotencyKey,
  };

  return input.ctx.treasuryModule.quotes.commands.createQuote(createQuoteInput);
}

export async function previewDealScopedQuote(input: {
  body: any;
  ctx: AppContext;
  dealId: string;
}): Promise<QuotePreviewRecord> {
  const quoteInput = await buildDealScopedQuoteInput(input);
  return input.ctx.treasuryModule.quotes.queries.previewQuote(quoteInput);
}

async function buildDealScopedQuoteInput(input: {
  body: any;
  ctx: AppContext;
  dealId: string;
}) {
  const deal = await requireDeal(input.ctx, input.dealId);
  assertDealAllowsCommercialWrite(deal);

  const agreement = await input.ctx.agreementsModule.agreements.queries.findById(
    deal.agreementId,
  );
  if (!agreement) {
    throw new NotFoundError("Agreement", deal.agreementId);
  }

  const {
    fixedFeeAmount,
    fixedFeeCurrency,
    quoteMarkupBps,
    ...quoteBody
  } = input.body as {
    fixedFeeAmount?: string | null;
    fixedFeeCurrency?: string | null;
    quoteMarkupBps?: number | null;
  } & Record<string, unknown>;
  const defaults = extractAgreementCommercialDefaults({
    agreement,
    fallbackFixedFeeCurrency:
      typeof quoteBody.toCurrency === "string" ? quoteBody.toCurrency : null,
  });
  const hasFixedFeeOverride =
    fixedFeeAmount !== undefined || fixedFeeCurrency !== undefined;
  const normalizedFixedFeeAmount = hasFixedFeeOverride
    ? normalizeOptionalDecimalString(fixedFeeAmount, "fixedFeeAmount") ?? null
    : defaults.fixedFeeAmount;
  const normalizedFixedFeeCurrency = hasFixedFeeOverride
    ? fixedFeeCurrency?.trim().toUpperCase() || null
    : defaults.fixedFeeCurrency;
  type PreviewQuoteInput = Parameters<
    AppContext["treasuryModule"]["quotes"]["queries"]["previewQuote"]
  >[0];

  const previewQuoteInput: PreviewQuoteInput = {
    ...(quoteBody as PreviewQuoteInput),
    commercialTerms: {
      agreementVersionId: defaults.agreementVersionId,
      agreementFeeBps: defaults.agreementFeeBps.toString(),
      quoteMarkupBps: (quoteMarkupBps ?? 0).toString(),
      fixedFeeAmount: normalizedFixedFeeAmount,
      fixedFeeCurrency: normalizedFixedFeeCurrency,
    },
  };

  return previewQuoteInput;
}

export async function createDealScopedFormalDocument(input: {
  actorUserId: string;
  body: DealScopedCreateDocumentInput;
  ctx: AppContext;
  dealId: string;
  docType: string;
  idempotencyKey: string;
  requestContext?: Parameters<AppContext["documentDraftWorkflow"]["createDraft"]>[0]["requestContext"];
}) {
  const deal = await requireDeal(input.ctx, input.dealId);
  assertDealAllowsFormalDocumentCreate(deal);

  if (input.body.dealId && input.body.dealId !== input.dealId) {
    throw new ValidationError(
      `Document dealId ${input.body.dealId} does not match route deal ${input.dealId}`,
    );
  }

  const payload =
    input.docType === "invoice"
      ? await enrichDealScopedInvoicePayload({
          ctx: input.ctx,
          dealId: input.dealId,
          payload: input.body.input,
        })
      : input.body.input;

  return input.ctx.documentDraftWorkflow.createDraft({
    actorUserId: input.actorUserId,
    createIdempotencyKey: input.idempotencyKey,
    dealId: input.dealId,
    docType: input.docType,
    payload,
    requestContext: input.requestContext,
  });
}

function readInvoicePurpose(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return "combined";
  }

  const value = (payload as Record<string, unknown>).invoicePurpose;
  return value === "principal" || value === "agency_fee" ? value : "combined";
}

async function enrichDealScopedInvoicePayload(input: {
  ctx: AppContext;
  dealId: string;
  payload: unknown;
}) {
  const purpose = readInvoicePurpose(input.payload);

  if (purpose === "combined") {
    return input.payload;
  }

  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) {
    return input.payload;
  }

  const workflow = await input.ctx.dealsModule.deals.queries.findWorkflowById(
    input.dealId,
  );
  const quoteId = workflow?.acceptedQuote?.quoteId ?? null;
  if (!quoteId) {
    throw new ValidationError(
      "Split invoice creation requires an accepted quote",
    );
  }

  const quoteDetails = await input.ctx.treasuryModule.quotes.queries.getQuoteDetails({
    quoteRef: quoteId,
  });
  const selection = resolveDealInvoiceBillingSelection({
    dealId: input.dealId,
    invoicePurpose: purpose,
    quoteDetails,
  });
  const sourcePayload = input.payload as Record<string, unknown>;

  return {
    ...sourcePayload,
    amount: minorToAmountString(selection.amountMinor, {
      currency: selection.currency,
    }),
    billingSetRef: selection.billingSetRef,
    currency: selection.currency,
    invoicePurpose: selection.invoicePurpose,
    quoteComponentIds: selection.quoteComponentIds,
  };
}

export async function buildDealTrace(
  ctx: AppContext,
  dealId: string,
): Promise<DealTrace> {
  const deal = await requireDeal(ctx, dealId);
  const [quotesResult, documentRows] = await Promise.all([
    ctx.treasuryModule.quotes.queries.listQuotes({
      dealId,
      limit: 500,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
    ctx.documentsReadModel.listDealTraceRowsByDealId(dealId),
  ]);

  const formalDocuments = documentRows.map((row) => ({
    approvalStatus: row.approvalStatus,
    dealId: row.dealId,
    docType: row.docType,
    id: row.documentId,
    ledgerOperationIds: row.ledgerOperationIds,
    lifecycleStatus: row.lifecycleStatus,
    occurredAt: row.occurredAt,
    postingStatus: row.postingStatus,
    submissionStatus: row.submissionStatus,
  }));
  const ledgerOperationIds = [
    ...new Set(formalDocuments.flatMap((row) => row.ledgerOperationIds)),
  ];
  const trace = {
    calculationId: deal.calculationId,
    dealId: deal.id,
    formalDocuments,
    generatedFiles: [],
    ledgerOperationIds,
    quotes: quotesResult.data.map((quote) => ({
      createdAt: quote.createdAt,
      dealId: quote.dealId,
      expiresAt: quote.expiresAt,
      id: quote.id,
      status: quote.status,
      usedDocumentId: quote.usedDocumentId,
    })),
    status: deal.status,
    type: deal.type,
  };

  return DealTraceSchema.parse(trace);
}
