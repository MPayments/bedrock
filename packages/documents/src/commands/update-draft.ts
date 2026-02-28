import { and, eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";

import { DocumentValidationError } from "../errors";
import { createModuleContext, lockDocument, buildSummary, resolveModule } from "../internal/helpers";
import type { DocumentsServiceContext } from "../internal/context";
import { validateInput } from "../validation";
import type { DocumentWithOperationId } from "../types";

export function createUpdateDraftHandler(context: DocumentsServiceContext) {
  const { db, log, registry } = context;

  return async function updateDraft(input: {
    docType: string;
    documentId: string;
    payload: unknown;
    actorUserId: string;
  }): Promise<DocumentWithOperationId> {
    const module = resolveModule(registry, input.docType);
    const validatedUpdateInput = validateInput(
      module.updateSchema,
      input.payload,
      `${input.docType}.update`,
    );

    return db.transaction(async (tx) => {
      const moduleContext = createModuleContext({
        db: tx,
        actorUserId: input.actorUserId,
        now: new Date(),
        log,
      });
      const document = await lockDocument(tx, input.documentId, input.docType);

      if (document.submissionStatus !== "draft" || document.lifecycleStatus !== "active") {
        throw new DocumentValidationError(
          "Only active draft documents can be updated",
        );
      }

      await module.canEdit(moduleContext, document);

      const updated = await module.updateDraft(
        moduleContext,
        document,
        validatedUpdateInput,
      );
      const payload = validateInput(
        module.payloadSchema,
        updated.payload,
        `${input.docType}.payload`,
      );

      const next = {
        ...document,
        payload,
        occurredAt: updated.occurredAt ?? document.occurredAt,
      };
      const approvalStatus = module.approvalRequired(next) ? "pending" : "not_required";
      const summary = buildSummary(
        module.deriveSummary({ ...next, approvalStatus }),
      );

      const [stored] = await tx
        .update(schema.documents)
        .set({
          payload,
          occurredAt: updated.occurredAt ?? document.occurredAt,
          approvalStatus,
          title: summary.title,
          amountMinor: summary.amountMinor,
          currency: summary.currency,
          memo: summary.memo,
          counterpartyId: summary.counterpartyId,
          customerId: summary.customerId,
          operationalAccountId: summary.operationalAccountId,
          searchText: summary.searchText,
          updatedAt: sql`now()`,
          version: sql`${schema.documents.version} + 1`,
        })
        .where(
          and(
            eq(schema.documents.id, document.id),
            eq(schema.documents.docType, input.docType),
          ),
        )
        .returning();

      return { document: stored!, postingOperationId: null };
    });
  };
}
