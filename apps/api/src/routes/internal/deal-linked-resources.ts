import { and, eq, inArray } from "drizzle-orm";
import { z } from "@hono/zod-openapi";

import { canDealWriteTreasuryOrFormalDocuments } from "@bedrock/deals";
import type { DealDetails, DealTrace } from "@bedrock/deals/contracts";
import { DealTraceSchema } from "@bedrock/deals/contracts";
import { fileLinks } from "@bedrock/files/schema";
import {
  documentBusinessLinks,
  documentOperations,
  documents,
} from "@bedrock/documents/schema";
import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";
import { fxQuotes } from "@bedrock/treasury/schema";

import { db } from "../../db/client";
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

export async function createDealScopedQuote(input: {
  body: Omit<Parameters<AppContext["treasuryModule"]["quotes"]["commands"]["createQuote"]>[0], "dealId" | "idempotencyKey">;
  ctx: AppContext;
  dealId: string;
  idempotencyKey: string;
}) {
  const deal = await requireDeal(input.ctx, input.dealId);
  assertDealAllowsCommercialWrite(deal);

  return input.ctx.treasuryModule.quotes.commands.createQuote({
    ...input.body,
    dealId: input.dealId,
    idempotencyKey: input.idempotencyKey,
  });
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
  assertDealAllowsCommercialWrite(deal);

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
    }),
    db
      .select({
        approvalStatus: documents.approvalStatus,
        dealId: documentBusinessLinks.dealId,
        docId: documents.id,
        docType: documents.docType,
        lifecycleStatus: documents.lifecycleStatus,
        occurredAt: documents.occurredAt,
        operationId: documentOperations.operationId,
        postingStatus: documents.postingStatus,
        submissionStatus: documents.submissionStatus,
      })
      .from(documentBusinessLinks)
      .innerJoin(documents, eq(documents.id, documentBusinessLinks.documentId))
      .leftJoin(
        documentOperations,
        eq(documentOperations.documentId, documents.id),
      )
      .where(eq(documentBusinessLinks.dealId, dealId)),
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

  const documentMap = new Map<
    string,
    {
      approvalStatus: string;
      dealId: string | null;
      docType: string;
      id: string;
      lifecycleStatus: string;
      occurredAt: Date;
      operationIds: string[];
      postingStatus: string;
      submissionStatus: string;
    }
  >();

  for (const row of documentRows) {
    const entry = documentMap.get(row.docId) ?? {
      approvalStatus: row.approvalStatus,
      dealId: row.dealId ?? null,
      docType: row.docType,
      id: row.docId,
      lifecycleStatus: row.lifecycleStatus,
      occurredAt: row.occurredAt,
      operationIds: [],
      postingStatus: row.postingStatus,
      submissionStatus: row.submissionStatus,
    };

    if (row.operationId) {
      entry.operationIds.push(row.operationId);
    }

    documentMap.set(row.docId, entry);
  }

  const formalDocuments = [...documentMap.values()].map((row) => ({
    approvalStatus: row.approvalStatus,
    dealId: row.dealId,
    docType: row.docType,
    id: row.id,
    ledgerOperationIds: [...new Set(row.operationIds)],
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
