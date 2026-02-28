import { and, eq } from "drizzle-orm";

import { schema, type Document } from "@bedrock/db/schema";
import type { Transaction } from "@bedrock/db";

import { validateInput } from "../validation";
import type { DocumentsServiceContext } from "../internal/context";
import {
  buildSummary,
  createDocumentInsertBase,
  createModuleContext,
  getDocumentByCreateIdempotencyKey,
  insertInitialLinks,
  resolveModule,
} from "../internal/helpers";
import type { DocumentWithOperationId } from "../types";

export function createCreateDraftHandler(context: DocumentsServiceContext) {
  const { db, log, registry } = context;

  return async function createDraft(input: {
    docType: string;
    createIdempotencyKey: string;
    payload: unknown;
    actorUserId: string;
  }): Promise<DocumentWithOperationId> {
    const module = resolveModule(registry, input.docType);

    const existing = await getDocumentByCreateIdempotencyKey(
      db,
      input.docType,
      input.createIdempotencyKey,
    );
    if (existing) {
      return { document: existing, postingOperationId: null };
    }

    const validatedCreateInput = validateInput(
      module.createSchema,
      input.payload,
      `${input.docType}.create`,
    );

    return db.transaction(async (tx: Transaction) => {
      const moduleContext = createModuleContext({
        db: tx,
        actorUserId: input.actorUserId,
        now: new Date(),
        log,
      });

      const replay = await getDocumentByCreateIdempotencyKey(
        tx,
        input.docType,
        input.createIdempotencyKey,
      );
      if (replay) {
        return { document: replay, postingOperationId: null };
      }

      await module.canCreate(moduleContext, validatedCreateInput);

      const draft = await module.createDraft(moduleContext, validatedCreateInput);
      const payload = validateInput(
        module.payloadSchema,
        draft.payload,
        `${input.docType}.payload`,
      );

      const base = createDocumentInsertBase({
        docType: module.docType,
        docNoPrefix: module.docNoPrefix,
        payloadVersion: module.payloadVersion,
        payload,
        occurredAt: draft.occurredAt,
        createIdempotencyKey: input.createIdempotencyKey,
        createdBy: input.actorUserId,
        approvalStatus: "not_required",
        postingStatus: module.postingRequired ? "unposted" : "not_required",
      });

      const transient: Document = {
        ...base,
        approvalStatus: module.approvalRequired(base) ? "pending" : "not_required",
      };
      const summary = buildSummary(module.deriveSummary(transient));

      const values = {
        ...transient,
        ...summary,
      };

      const [inserted] = await tx
        .insert(schema.documents)
        .values(values)
        .onConflictDoNothing()
        .returning();

      const document =
        inserted ??
        (await getDocumentByCreateIdempotencyKey(
          tx,
          input.docType,
          input.createIdempotencyKey,
        ));

      if (!document) {
        throw new Error("Failed to create document draft");
      }

      const links = await module.buildInitialLinks?.(moduleContext, document);
      if (links && links.length > 0) {
        await insertInitialLinks(tx, document, links);
      }

      return { document, postingOperationId: null };
    });
  };
}
