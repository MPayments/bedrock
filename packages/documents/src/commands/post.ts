import { and, eq, sql } from "drizzle-orm";

import { schema } from "@bedrock/db/schema";
import { InvalidStateError } from "@bedrock/kernel/errors";

import { DocumentPostingNotRequiredError } from "../errors";
import {
  assertDocumentIsActive,
  createModuleContext,
  lockDocument,
  resolveModule,
} from "../internal/helpers";
import type { DocumentsServiceContext } from "../internal/context";
import type { DocumentWithOperationId } from "../types";

export function createPostHandler(context: DocumentsServiceContext) {
  const { db, ledger, log, registry } = context;

  return async function post(input: {
    docType: string;
    documentId: string;
    actorUserId: string;
  }): Promise<DocumentWithOperationId> {
    const module = resolveModule(registry, input.docType);

    return db.transaction(async (tx) => {
      const moduleContext = createModuleContext({
        db: tx,
        actorUserId: input.actorUserId,
        now: new Date(),
        log,
      });
      const document = await lockDocument(tx, input.documentId, input.docType);
      assertDocumentIsActive(document, "posted");

      const [existingOperation] = await tx
        .select({ operationId: schema.documentOperations.operationId })
        .from(schema.documentOperations)
        .where(
          and(
            eq(schema.documentOperations.documentId, document.id),
            eq(schema.documentOperations.kind, "post"),
          ),
        )
        .limit(1);

      if (existingOperation) {
        return {
          document,
          postingOperationId: existingOperation.operationId,
        };
      }

      if (!module.postingRequired || document.postingStatus === "not_required") {
        throw new DocumentPostingNotRequiredError(document.id, document.docType);
      }
      if (document.submissionStatus !== "submitted") {
        throw new InvalidStateError("Document must be submitted before posting");
      }
      if (
        document.approvalStatus !== "approved" &&
        document.approvalStatus !== "not_required"
      ) {
        throw new InvalidStateError("Document must be approved before posting");
      }
      if (document.postingStatus !== "unposted") {
        throw new InvalidStateError("Document is not ready for posting");
      }
      if (!module.buildIntent) {
        throw new DocumentPostingNotRequiredError(document.id, document.docType);
      }

      await module.canPost(moduleContext, document);

      const intent = await module.buildIntent(moduleContext, document);
      const result = await ledger.commit(tx, {
        source: {
          type: `documents/${document.docType}/post`,
          id: document.id,
        },
        operationCode: intent.operationCode,
        operationVersion: intent.operationVersion ?? 1,
        payload: intent.payload,
        idempotencyKey: module.buildPostIdempotencyKey(document),
        postingDate: document.occurredAt,
        bookOrgId: intent.bookOrgId,
        lines: intent.lines,
      });

      await tx
        .insert(schema.documentOperations)
        .values({
          documentId: document.id,
          operationId: result.operationId,
          kind: "post",
        })
        .onConflictDoNothing();

      const [stored] = await tx
        .update(schema.documents)
        .set({
          postingStatus: "posting",
          postingStartedAt: sql`now()`,
          postingError: null,
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

      return {
        document: stored!,
        postingOperationId: result.operationId,
      };
    });
  };
}
