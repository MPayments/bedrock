import { z } from "@hono/zod-openapi";
import { and, eq, inArray } from "drizzle-orm";

import {
  canDealCreateFormalDocuments,
  canDealWriteTreasuryOrFormalDocuments,
} from "@bedrock/deals";
import type { DealDetails, DealTrace } from "@bedrock/deals/contracts";
import { DealTraceSchema } from "@bedrock/deals/contracts";
import { fileLinks } from "@bedrock/files/schema";
import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";
import type { QuotePreviewRecord } from "@bedrock/treasury/contracts";

import {
  extractAgreementCommercialDefaults,
  normalizeOptionalDecimalString,
} from "../../composition/commercial-pricing";
import type { AppContext } from "../../context";
import { db } from "../../db/client";

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

export function assertDealAllowsFormalDocumentCreate(deal: DealDetails) {
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

  return input.ctx.documentDraftWorkflow.createDraft({
    actorUserId: input.actorUserId,
    createIdempotencyKey: input.idempotencyKey,
    dealId: input.dealId,
    docType: input.docType,
    payload: input.body.input,
    requestContext: input.requestContext,
  });
}

export async function buildDealTrace(
  ctx: AppContext,
  dealId: string,
): Promise<DealTrace> {
  const deal = await requireDeal(ctx, dealId);
  const [quotesResult, documentRows, generatedFileRows] = await Promise.all([
    ctx.treasuryModule.quotes.queries.listQuotes({
      dealId,
      limit: 500,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
    ctx.documentsReadModel.listDealTraceRowsByDealId(dealId),
    db
      .select({
        fileAssetId: fileLinks.fileAssetId,
        linkKind: fileLinks.linkKind,
      })
      .from(fileLinks)
      .where(
        and(
          eq(fileLinks.dealId, dealId),
          inArray(fileLinks.linkKind, [
            "deal_application",
            "deal_invoice",
            "deal_acceptance",
          ]),
        ),
      ),
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
    generatedFiles: generatedFileRows.map((row) => ({
      fileAssetId: row.fileAssetId,
      linkKind: row.linkKind,
    })),
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
