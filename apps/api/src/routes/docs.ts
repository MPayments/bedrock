import { OpenAPIHono } from "@hono/zod-openapi";

import {
  CreateDocumentInputSchema,
  type DocumentDetails as DocumentDetailsResult,
  type DocumentWithOperationId,
  DocumentGraphError,
  DocumentNotFoundError,
  DocumentPolicyDeniedError,
  DocumentPostingNotRequiredError,
  DocumentValidationError,
  ListDocumentsQuerySchema,
  UpdateDocumentInputSchema,
} from "@bedrock/documents";
import {
  ActionReceiptConflictError,
  ActionReceiptStoredError,
} from "@bedrock/idempotency";
import { InvalidStateError, PermissionError } from "@bedrock/kernel/errors";

import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import {
  getRequestContext,
  requireIdempotencyKey,
} from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";

function resolveErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isZodErrorLike(
  error: unknown,
): error is { flatten: () => unknown; issues: unknown[] } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown[] }).issues) &&
      "flatten" in error &&
      typeof (error as { flatten?: unknown }).flatten === "function",
  );
}

function toDocumentDto(input: DocumentWithOperationId) {
  const { document } = input;
  return {
    id: document.id,
    docType: document.docType,
    docNo: document.docNo,
    payloadVersion: document.payloadVersion,
    payload: document.payload,
    title: document.title,
    occurredAt: document.occurredAt.toISOString(),
    submissionStatus: document.submissionStatus,
    approvalStatus: document.approvalStatus,
    postingStatus: document.postingStatus,
    lifecycleStatus: document.lifecycleStatus,
    createIdempotencyKey: document.createIdempotencyKey,
    amountMinor: document.amountMinor?.toString() ?? null,
    currency: document.currency,
    memo: document.memo,
    counterpartyId: document.counterpartyId,
    customerId: document.customerId,
    operationalAccountId: document.operationalAccountId,
    searchText: document.searchText,
    createdBy: document.createdBy,
    submittedBy: document.submittedBy,
    submittedAt: document.submittedAt?.toISOString() ?? null,
    approvedBy: document.approvedBy,
    approvedAt: document.approvedAt?.toISOString() ?? null,
    rejectedBy: document.rejectedBy,
    rejectedAt: document.rejectedAt?.toISOString() ?? null,
    cancelledBy: document.cancelledBy,
    cancelledAt: document.cancelledAt?.toISOString() ?? null,
    postingStartedAt: document.postingStartedAt?.toISOString() ?? null,
    postedAt: document.postedAt?.toISOString() ?? null,
    postingError: document.postingError,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    version: document.version,
    postingOperationId: input.postingOperationId,
  };
}

function handleDocumentsError(c: any, error: unknown) {
  if (isZodErrorLike(error)) {
    return c.json(
      {
        error: "Validation error",
        details: error.flatten(),
      },
      400,
    );
  }
  if (error instanceof DocumentNotFoundError) {
    return c.json({ error: resolveErrorMessage(error) }, 404);
  }
  if (
    error instanceof PermissionError ||
    error instanceof DocumentPolicyDeniedError
  ) {
    return c.json({ error: resolveErrorMessage(error) }, 403);
  }
  if (
    error instanceof DocumentValidationError ||
    error instanceof DocumentGraphError
  ) {
    return c.json({ error: resolveErrorMessage(error) }, 400);
  }
  if (
    error instanceof InvalidStateError ||
    error instanceof DocumentPostingNotRequiredError ||
    error instanceof ActionReceiptConflictError ||
    error instanceof ActionReceiptStoredError
  ) {
    return c.json({ error: resolveErrorMessage(error) }, 409);
  }

  throw error;
}

function queryObjectFromUrl(requestUrl: string) {
  const params = new URL(requestUrl).searchParams;
  const query: Record<string, string | string[]> = {};

  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    query[key] = values.length > 1 ? values : (values[0] ?? "");
  }

  return query;
}

function toDocumentDetailsDto(details: DocumentDetailsResult) {
  return {
    document: toDocumentDto({
      document: details.document,
      postingOperationId: details.postingOperationId,
    }),
    links: details.links.map((link) => ({
      id: link.id,
      fromDocumentId: link.fromDocumentId,
      toDocumentId: link.toDocumentId,
      linkType: link.linkType,
      role: link.role,
      createdAt: link.createdAt.toISOString(),
    })),
    parent: details.parent
      ? toDocumentDto({ document: details.parent, postingOperationId: null })
      : null,
    children: details.children.map((document) =>
      toDocumentDto({ document, postingOperationId: null }),
    ),
    dependsOn: details.dependsOn.map((document) =>
      toDocumentDto({ document, postingOperationId: null }),
    ),
    compensates: details.compensates.map((document) =>
      toDocumentDto({ document, postingOperationId: null }),
    ),
    documentOperations: details.documentOperations.map((operation) => ({
      id: operation.id,
      documentId: operation.documentId,
      operationId: operation.operationId,
      kind: operation.kind,
      createdAt: operation.createdAt.toISOString(),
    })),
    events: details.events.map((event) => ({
      id: event.id,
      documentId: event.documentId,
      eventType: event.eventType,
      actorId: event.actorId,
      requestId: event.requestId,
      correlationId: event.correlationId,
      traceId: event.traceId,
      causationId: event.causationId,
      reasonCode: event.reasonCode,
      reasonMeta: event.reasonMeta,
      before: event.before,
      after: event.after,
      createdAt: event.createdAt.toISOString(),
    })),
    snapshot: details.snapshot
      ? {
          id: details.snapshot.id,
          documentId: details.snapshot.documentId,
          payload: details.snapshot.payload,
          payloadVersion: details.snapshot.payloadVersion,
          moduleId: details.snapshot.moduleId,
          moduleVersion: details.snapshot.moduleVersion,
          packChecksum: details.snapshot.packChecksum,
          postingPlanChecksum: details.snapshot.postingPlanChecksum,
          journalIntentChecksum: details.snapshot.journalIntentChecksum,
          postingPlan: details.snapshot.postingPlan,
          journalIntent: details.snapshot.journalIntent,
          resolvedTemplates: details.snapshot.resolvedTemplates,
          createdAt: details.snapshot.createdAt.toISOString(),
        }
      : null,
    ledgerOperations: details.ledgerOperations,
    computed: details.computed,
    extra: details.extra,
  };
}

export function docsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  app.get("/", requirePermission({ documents: ["list"] }), async (c) => {
    try {
      const query = ListDocumentsQuerySchema.parse(queryObjectFromUrl(c.req.url));
      const result = await ctx.documentsService.list(query);
      return c.json({
        ...result,
        data: result.data.map(toDocumentDto),
      });
    } catch (error) {
      return handleDocumentsError(c, error);
    }
  });

  app.post("/:docType", requirePermission({ documents: ["create"] }), async (c) => {
    try {
      const { docType } = c.req.param();
      const body = CreateDocumentInputSchema.parse(await c.req.json());
      const result = await ctx.documentsService.createDraft({
        docType,
        createIdempotencyKey: body.createIdempotencyKey,
        payload: body.input,
        actorUserId: c.get("user")!.id,
        requestContext: getRequestContext(c),
      });
      return c.json(toDocumentDto(result), 201);
    } catch (error) {
      return handleDocumentsError(c, error);
    }
  });

  app.patch("/:docType/:id", requirePermission({ documents: ["update"] }), async (c) => {
    try {
      const { docType, id } = c.req.param();
      const idem = requireIdempotencyKey(c);
      if (!idem.ok) return idem.response;
      const body = UpdateDocumentInputSchema.parse(await c.req.json());
      const result = await ctx.documentsService.updateDraft({
        docType,
        documentId: id,
        payload: body.input,
        actorUserId: c.get("user")!.id,
        idempotencyKey: idem.idempotencyKey,
        requestContext: getRequestContext(c),
      });
      return c.json(toDocumentDto(result));
    } catch (error) {
      return handleDocumentsError(c, error);
    }
  });

  app.get("/:docType/:id", requirePermission({ documents: ["get"] }), async (c) => {
    try {
      const { docType, id } = c.req.param();
      const result = await ctx.documentsService.get(docType, id);
      return c.json(toDocumentDto(result));
    } catch (error) {
      return handleDocumentsError(c, error);
    }
  });

  app.get(
    "/:docType/:id/details",
    requirePermission({ documents: ["get"] }),
    async (c) => {
      try {
        const { docType, id } = c.req.param();
        const details = await ctx.documentsService.getDetails(
          docType,
          id,
          c.get("user")!.id,
        );
        return c.json(toDocumentDetailsDto(details));
      } catch (error) {
        return handleDocumentsError(c, error);
      }
    },
  );

  app.post(
    "/:docType/:id/submit",
    requirePermission({ documents: ["submit"] }),
    async (c) => {
      try {
        const { docType, id } = c.req.param();
        const idem = requireIdempotencyKey(c);
        if (!idem.ok) return idem.response;
        const result = await ctx.documentsService.submit({
          docType,
          documentId: id,
          actorUserId: c.get("user")!.id,
          idempotencyKey: idem.idempotencyKey,
          requestContext: getRequestContext(c),
        });
        return c.json(toDocumentDto(result));
      } catch (error) {
        return handleDocumentsError(c, error);
      }
    },
  );

  app.post(
    "/:docType/:id/approve",
    requirePermission({ documents: ["approve"] }),
    async (c) => {
      try {
        const { docType, id } = c.req.param();
        const idem = requireIdempotencyKey(c);
        if (!idem.ok) return idem.response;
        const result = await ctx.documentsService.approve({
          docType,
          documentId: id,
          actorUserId: c.get("user")!.id,
          idempotencyKey: idem.idempotencyKey,
          requestContext: getRequestContext(c),
        });
        return c.json(toDocumentDto(result));
      } catch (error) {
        return handleDocumentsError(c, error);
      }
    },
  );

  app.post(
    "/:docType/:id/reject",
    requirePermission({ documents: ["reject"] }),
    async (c) => {
      try {
        const { docType, id } = c.req.param();
        const idem = requireIdempotencyKey(c);
        if (!idem.ok) return idem.response;
        const result = await ctx.documentsService.reject({
          docType,
          documentId: id,
          actorUserId: c.get("user")!.id,
          idempotencyKey: idem.idempotencyKey,
          requestContext: getRequestContext(c),
        });
        return c.json(toDocumentDto(result));
      } catch (error) {
        return handleDocumentsError(c, error);
      }
    },
  );

  app.post("/:docType/:id/post", requirePermission({ documents: ["post"] }), async (c) => {
    try {
      const { docType, id } = c.req.param();
      const idem = requireIdempotencyKey(c);
      if (!idem.ok) return idem.response;
      const result = await ctx.documentsService.post({
        docType,
        documentId: id,
        actorUserId: c.get("user")!.id,
        idempotencyKey: idem.idempotencyKey,
        requestContext: getRequestContext(c),
      });
      return c.json(toDocumentDto(result));
    } catch (error) {
      return handleDocumentsError(c, error);
    }
  });

  app.post(
    "/:docType/:id/cancel",
    requirePermission({ documents: ["cancel"] }),
    async (c) => {
      try {
        const { docType, id } = c.req.param();
        const idem = requireIdempotencyKey(c);
        if (!idem.ok) return idem.response;
        const result = await ctx.documentsService.cancel({
          docType,
          documentId: id,
          actorUserId: c.get("user")!.id,
          idempotencyKey: idem.idempotencyKey,
          requestContext: getRequestContext(c),
        });
        return c.json(toDocumentDto(result));
      } catch (error) {
        return handleDocumentsError(c, error);
      }
    },
  );

  app.post(
    "/:docType/:id/repost",
    requirePermission({ documents: ["post"] }),
    async (c) => {
      try {
        const { docType, id } = c.req.param();
        const idem = requireIdempotencyKey(c);
        if (!idem.ok) return idem.response;
        const result = await ctx.documentsService.repost({
          docType,
          documentId: id,
          actorUserId: c.get("user")!.id,
          idempotencyKey: idem.idempotencyKey,
          requestContext: getRequestContext(c),
        });
        return c.json(toDocumentDto(result));
      } catch (error) {
        return handleDocumentsError(c, error);
      }
    },
  );

  return app;
}
