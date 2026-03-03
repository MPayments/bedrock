import { OpenAPIHono } from "@hono/zod-openapi";

import {
  CreateDocumentInputSchema,
  type DocumentAction,
  type DocumentDetails as DocumentDetailsResult,
  type DocumentWithOperationId,
  ListDocumentsQuerySchema,
  DocumentSystemOnlyTypeError,
  UpdateDocumentInputSchema,
  isSystemOnlyDocumentType,
} from "@bedrock/core/documents";

import auth from "../auth";
import { minorToAmountString, normalizeMoneyFields } from "../common/amount";
import { handleRouteError } from "../common/errors";
import { toJsonSafe } from "../common/json";
import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { withEtag } from "../middleware/etag";
import {
  getRequestContext,
  withRequiredIdempotency,
} from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";

const DOCUMENT_ACTION_TO_PERMISSION = {
  edit: "update",
  submit: "submit",
  approve: "approve",
  reject: "reject",
  post: "post",
  cancel: "cancel",
  repost: "post",
} as const;

const DOCUMENT_ACTION_TO_PUBLIC_ACTION = {
  edit: "update",
  submit: "submit",
  approve: "approve",
  reject: "reject",
  post: "post",
  cancel: "cancel",
  repost: "repost",
} as const;

type DocumentPermissionAction =
  (typeof DOCUMENT_ACTION_TO_PERMISSION)[DocumentAction];

interface DocumentMutationServiceInput {
  docType: string;
  documentId: string;
  actorUserId: string;
  idempotencyKey: string;
  requestContext: ReturnType<typeof getRequestContext>;
}

interface DocumentMutationConfig {
  path: string;
  permission: DocumentPermissionAction;
  action: "submit" | "approve" | "reject" | "post" | "cancel" | "repost";
  serviceCall: (input: DocumentMutationServiceInput) => Promise<DocumentWithOperationId>;
}

function toDocumentDto(input: DocumentWithOperationId) {
  const { document } = input;
  return {
    id: document.id,
    docType: document.docType,
    docNo: document.docNo,
    payloadVersion: document.payloadVersion,
    payload: toJsonSafe(normalizeMoneyFields(document.payload)),
    title: document.title,
    occurredAt: document.occurredAt.toISOString(),
    submissionStatus: document.submissionStatus,
    approvalStatus: document.approvalStatus,
    postingStatus: document.postingStatus,
    lifecycleStatus: document.lifecycleStatus,
    createIdempotencyKey: document.createIdempotencyKey,
    amount:
      document.amountMinor == null
        ? null
        : minorToAmountString(document.amountMinor, {
            currency: document.currency,
          }),
    currency: document.currency,
    memo: document.memo,
    counterpartyId: document.counterpartyId,
    customerId: document.customerId,
    counterpartyAccountId: document.counterpartyAccountId,
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
    allowedActions: input.allowedActions,
  };
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
  return toJsonSafe(
    normalizeMoneyFields({
      document: toDocumentDto({
        document: details.document,
        postingOperationId: details.postingOperationId,
        allowedActions: details.allowedActions,
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
        ? toDocumentDto({
            document: details.parent,
            postingOperationId: null,
            allowedActions: [],
          })
        : null,
      children: details.children.map((document) =>
        toDocumentDto({
          document,
          postingOperationId: null,
          allowedActions: [],
        }),
      ),
      dependsOn: details.dependsOn.map((document) =>
        toDocumentDto({
          document,
          postingOperationId: null,
          allowedActions: [],
        }),
      ),
      compensates: details.compensates.map((document) =>
        toDocumentDto({
          document,
          postingOperationId: null,
          allowedActions: [],
        }),
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
    }),
  );
}

export function documentsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  function assertPublicMutationAllowed(input: {
    docType: string;
    action:
      | "create"
      | "update"
      | "submit"
      | "approve"
      | "reject"
      | "post"
      | "cancel"
      | "repost";
    role: string | null | undefined;
  }) {
    if (
      input.docType === "period_reopen" &&
      input.action === "create" &&
      input.role === "admin"
    ) {
      return;
    }
    if (isSystemOnlyDocumentType(input.docType)) {
      throw new DocumentSystemOnlyTypeError(input.docType);
    }
  }

  async function resolveDocumentActionPermissions(
    userId: string,
  ): Promise<Map<DocumentPermissionAction, boolean>> {
    const uniquePermissions = Array.from(
      new Set<DocumentPermissionAction>(
        Object.values(DOCUMENT_ACTION_TO_PERMISSION),
      ),
    );
    const checks = await Promise.all(
      uniquePermissions.map(async (permission) => {
        try {
          const result = await auth.api.userHasPermission({
            body: {
              userId,
              permissions: {
                documents: [permission],
              },
            },
          });
          return [permission, result.success] as const;
        } catch {
          return [permission, false] as const;
        }
      }),
    );

    return new Map(checks);
  }

  function filterAllowedDocumentActions(input: {
    docType: string;
    role: string | null | undefined;
    allowedActions: DocumentAction[];
    actionPermissions: Map<DocumentPermissionAction, boolean>;
  }): DocumentAction[] {
    return input.allowedActions.filter((action) => {
      try {
        assertPublicMutationAllowed({
          docType: input.docType,
          action: DOCUMENT_ACTION_TO_PUBLIC_ACTION[action],
          role: input.role,
        });
      } catch {
        return false;
      }

      const permission = DOCUMENT_ACTION_TO_PERMISSION[action];
      return input.actionPermissions.get(permission) === true;
    });
  }

  function registerDocumentMutationAction(config: DocumentMutationConfig) {
    app.post(
      config.path,
      requirePermission({ documents: [config.permission] }),
      async (c) => {
        try {
          const docType = c.req.param("docType")!;
          const id = c.req.param("id")!;
          assertPublicMutationAllowed({
            docType,
            action: config.action,
            role: c.get("user")?.role,
          });
          const result = await withRequiredIdempotency(c, (idempotencyKey) =>
            config.serviceCall({
              docType,
              documentId: id,
              actorUserId: c.get("user")!.id,
              idempotencyKey,
              requestContext: getRequestContext(c),
            }),
          );
          if (result instanceof Response) return result;
          return jsonOk(c, toDocumentDto(result));
        } catch (error) {
          return handleRouteError(c, error);
        }
      },
    );
  }

  app.get("/", requirePermission({ documents: ["list"] }), async (c) => {
    try {
      const user = c.get("user")!;
      const query = ListDocumentsQuerySchema.parse(
        queryObjectFromUrl(c.req.url),
      );
      const actionPermissions = await resolveDocumentActionPermissions(user.id);
      const result = await ctx.documentsService.list(query, user.id);
      return c.json({
        ...result,
        data: result.data.map((item) =>
          toDocumentDto({
            ...item,
            allowedActions: filterAllowedDocumentActions({
              docType: item.document.docType,
              role: user.role,
              allowedActions: item.allowedActions,
              actionPermissions,
            }),
          }),
        ),
      });
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.post(
    "/:docType",
    requirePermission({ documents: ["create"] }),
    async (c) => {
      try {
        const { docType } = c.req.param();
        assertPublicMutationAllowed({
          docType,
          action: "create",
          role: c.get("user")?.role,
        });
        const body = CreateDocumentInputSchema.parse(await c.req.json());
        const result = await ctx.documentsService.createDraft({
          docType,
          createIdempotencyKey: body.createIdempotencyKey,
          payload: body.input,
          actorUserId: c.get("user")!.id,
          requestContext: getRequestContext(c),
        });
        return jsonOk(c, toDocumentDto(result), 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.patch(
    "/:docType/:id",
    requirePermission({ documents: ["update"] }),
    async (c) => {
      try {
        const { docType, id } = c.req.param();
        assertPublicMutationAllowed({
          docType,
          action: "update",
          role: c.get("user")?.role,
        });
        const body = UpdateDocumentInputSchema.parse(await c.req.json());
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.documentsService.updateDraft({
            docType,
            documentId: id,
            payload: body.input,
            actorUserId: c.get("user")!.id,
            idempotencyKey,
            requestContext: getRequestContext(c),
          }),
        );
        if (result instanceof Response) return result;
        return jsonOk(c, toDocumentDto(result));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.get(
    "/:docType/:id",
    requirePermission({ documents: ["get"] }),
    withEtag((b) => b.version as number | undefined),
    async (c) => {
      try {
        const user = c.get("user")!;
        const { docType, id } = c.req.param();
        const actionPermissions = await resolveDocumentActionPermissions(
          user.id,
        );
        const result = await ctx.documentsService.get(docType, id, user.id);
        const filtered = {
          ...result,
          allowedActions: filterAllowedDocumentActions({
            docType: result.document.docType,
            role: user.role,
            allowedActions: result.allowedActions,
            actionPermissions,
          }),
        };
        return c.json(toDocumentDto(filtered));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.get(
    "/:docType/:id/details",
    requirePermission({ documents: ["get"] }),
    withEtag((b) => {
      const doc = b.document as Record<string, unknown> | undefined;
      return doc?.version as number | undefined;
    }),
    async (c) => {
      try {
        const user = c.get("user")!;
        const { docType, id } = c.req.param();
        const details = await ctx.documentsService.getDetails(
          docType,
          id,
          user.id,
        );
        const actionPermissions = await resolveDocumentActionPermissions(
          user.id,
        );
        const filtered = {
          ...details,
          allowedActions: filterAllowedDocumentActions({
            docType: details.document.docType,
            role: user.role,
            allowedActions: details.allowedActions,
            actionPermissions,
          }),
        };
        return c.json(toDocumentDetailsDto(filtered));
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  registerDocumentMutationAction({
    path: "/:docType/:id/submit",
    permission: "submit",
    action: "submit",
    serviceCall: ctx.documentsService.submit,
  });
  registerDocumentMutationAction({
    path: "/:docType/:id/approve",
    permission: "approve",
    action: "approve",
    serviceCall: ctx.documentsService.approve,
  });
  registerDocumentMutationAction({
    path: "/:docType/:id/reject",
    permission: "reject",
    action: "reject",
    serviceCall: ctx.documentsService.reject,
  });
  registerDocumentMutationAction({
    path: "/:docType/:id/post",
    permission: "post",
    action: "post",
    serviceCall: ctx.documentsService.post,
  });
  registerDocumentMutationAction({
    path: "/:docType/:id/cancel",
    permission: "cancel",
    action: "cancel",
    serviceCall: ctx.documentsService.cancel,
  });
  registerDocumentMutationAction({
    path: "/:docType/:id/repost",
    permission: "post",
    action: "repost",
    serviceCall: ctx.documentsService.repost,
  });

  return app;
}
