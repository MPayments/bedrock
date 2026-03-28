import { OpenAPIHono, z } from "@hono/zod-openapi";

import {
  DocumentSystemOnlyTypeError,
  type DocumentAction,
  isSystemOnlyDocumentType,
} from "@bedrock/documents";
import {
  CreateDocumentInputSchema,
  type DocumentTransitionAction,
  ListDocumentsQuerySchema,
  UpdateDocumentInputSchema,
} from "@bedrock/documents/contracts";

import auth from "../auth";
import { handleRouteError } from "../common/errors";
import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { withEtag } from "../middleware/etag";
import { getRequestContext } from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";
import { mapOperationDetailsDto } from "./accounting/mappers";
import {
  queryObjectFromUrl,
  toDocumentDetailsDto,
  toDocumentDto,
} from "./internal/document-dto";
import { registerIdempotentMutationRoute } from "./internal/register-idempotent-mutation-route";

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

interface DocumentMutationConfig {
  path: string;
  permission: DocumentPermissionAction;
  action: DocumentTransitionAction;
}

type PublicDocumentMutationAction =
  | "create"
  | "update"
  | "submit"
  | "approve"
  | "reject"
  | "post"
  | "cancel"
  | "repost";

const PUBLIC_MUTATION_BLOCKED_ACTIONS_BY_DOC_TYPE: Partial<
  Record<string, Set<PublicDocumentMutationAction>>
> = {
  payment_order: new Set([
    "create",
    "update",
    "submit",
    "approve",
    "reject",
    "post",
    "cancel",
    "repost",
  ]),
  transfer_resolution: new Set([
    "create",
    "update",
    "submit",
    "approve",
    "reject",
    "post",
    "cancel",
    "repost",
  ]),
  fx_execute: new Set([
    "update",
    "submit",
    "approve",
    "reject",
    "post",
    "cancel",
    "repost",
  ]),
  fx_resolution: new Set([
    "create",
    "update",
    "submit",
    "approve",
    "reject",
    "post",
    "cancel",
    "repost",
  ]),
};

const OperationParamSchema = z.object({
  operationId: z.uuid(),
});

const JournalOperationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(["createdAt", "postingDate", "postedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  query: z.string().trim().min(1).optional(),
  status: z
    .array(z.enum(["pending", "posted", "failed"]))
    .min(1)
    .optional(),
  operationCode: z.array(z.string().trim().min(1)).min(1).optional(),
  sourceType: z.array(z.string().trim().min(1)).min(1).optional(),
  sourceId: z.string().trim().min(1).optional(),
  bookId: z.string().trim().min(1).optional(),
  dimensionFilters: z
    .record(z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1))
    .optional(),
});

const JOURNAL_OPERATION_STATUSES = new Set(["pending", "posted", "failed"]);
const JOURNAL_SORTABLE_COLUMNS = new Set(["createdAt", "postingDate", "postedAt"]);

function readFirstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readNonEmptyQueryString(value: string | string[] | undefined) {
  const normalized = readFirstQueryValue(value)?.trim();
  return normalized ? normalized : undefined;
}

function readQueryStringArray(value: string | string[] | undefined) {
  const values = (Array.isArray(value) ? value : value ? [value] : [])
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return values.length > 0 ? values : undefined;
}

function readPositiveInt(
  value: string | string[] | undefined,
  fallback: number,
  input: { min: number; max?: number },
) {
  const parsed = Number(readFirstQueryValue(value));
  if (!Number.isInteger(parsed) || parsed < input.min) {
    return fallback;
  }

  if (typeof input.max === "number" && parsed > input.max) {
    return fallback;
  }

  return parsed;
}

function readDimensionFilters(
  query: Record<string, string | string[]>,
) {
  const entries = Object.entries(query)
    .filter(([key]) => key.startsWith("dimension."))
    .map(([key, value]) => {
      const dimensionKey = key.slice("dimension.".length).trim();
      const values = readQueryStringArray(value);

      return [dimensionKey, values] as const;
    })
    .filter(
      (entry): entry is [string, string[]] =>
        entry[0].length > 0 && Array.isArray(entry[1]) && entry[1].length > 0,
    );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function parseJournalOperationsQuery(requestUrl: string) {
  const query = queryObjectFromUrl(requestUrl);
  const sortBy = readNonEmptyQueryString(query.sortBy);
  const sortOrder = readNonEmptyQueryString(query.sortOrder);
  const status = (readQueryStringArray(query.status) ?? []).filter((value) =>
    JOURNAL_OPERATION_STATUSES.has(value),
  );
  const operationCode = readQueryStringArray(query.operationCode);
  const sourceType = readQueryStringArray(query.sourceType);

  const candidate = {
    limit: readPositiveInt(query.limit, 20, { min: 1, max: 200 }),
    offset: readPositiveInt(query.offset, 0, { min: 0 }),
    sortBy:
      sortBy && JOURNAL_SORTABLE_COLUMNS.has(sortBy)
        ? sortBy
        : undefined,
    sortOrder:
      sortOrder === "asc" || sortOrder === "desc" ? sortOrder : undefined,
    query: readNonEmptyQueryString(query.query),
    status: status.length > 0 ? status : undefined,
    operationCode,
    sourceType,
    sourceId: readNonEmptyQueryString(query.sourceId),
    bookId: readNonEmptyQueryString(query.bookId),
    dimensionFilters: readDimensionFilters(query),
  };
  const parsed = JournalOperationsQuerySchema.safeParse(candidate);

  if (parsed.success) {
    return parsed.data;
  }

  return JournalOperationsQuerySchema.parse({});
}

export function documentsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();
  const adminSystemOnlyActionsByDocType: Partial<
    Record<string, Set<PublicDocumentMutationAction>>
  > = {
    period_close: new Set(["submit", "approve", "reject", "cancel"]),
    period_reopen: new Set([
      "create",
      "update",
      "submit",
      "approve",
      "reject",
      "cancel",
    ]),
  };

  function assertPublicMutationAllowed(input: {
    docType: string;
    action: PublicDocumentMutationAction;
    role: string | null | undefined;
  }) {
    const allowedAdminActions = adminSystemOnlyActionsByDocType[input.docType];
    if (input.role === "admin" && allowedAdminActions?.has(input.action)) {
      return;
    }

    if (isSystemOnlyDocumentType(input.docType)) {
      throw new DocumentSystemOnlyTypeError(input.docType);
    }

    const blockedActions =
      PUBLIC_MUTATION_BLOCKED_ACTIONS_BY_DOC_TYPE[input.docType];
    if (blockedActions?.has(input.action)) {
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

  function withPublicAllowedActions<
    TResource extends {
      document: { docType: string };
      allowedActions: DocumentAction[];
    },
  >(input: {
    resource: TResource;
    role: string | null | undefined;
    actionPermissions: Map<DocumentPermissionAction, boolean>;
  }): TResource {
    return {
      ...input.resource,
      allowedActions: filterAllowedDocumentActions({
        docType: input.resource.document.docType,
        role: input.role,
        allowedActions: input.resource.allowedActions,
        actionPermissions: input.actionPermissions,
      }),
    };
  }

  function registerDocumentMutationAction(config: DocumentMutationConfig) {
    registerIdempotentMutationRoute({
      app,
      path: config.path,
      permission: { documents: [config.permission] },
      handle: async ({ c, actorUserId, idempotencyKey, requestContext }) => {
        const docType = c.req.param("docType")!;
        const id = c.req.param("id")!;
        assertPublicMutationAllowed({
          docType,
          action: config.action,
          role: c.get("user")?.role,
        });

        const transitionInput = {
          docType,
          documentId: id,
          actorUserId,
          idempotencyKey,
          requestContext,
        };

        if (config.action === "post") {
          return ctx.documentPostingWorkflow.post(transitionInput);
        }

        if (config.action === "repost") {
          return ctx.documentPostingWorkflow.repost(transitionInput);
        }

        return ctx.documentsModule.lifecycle.commands.execute({
          action: config.action,
          ...transitionInput,
        });
      },
      respond: (c, result) => jsonOk(c, toDocumentDto(result)),
      handleError: handleRouteError,
    });
  }

  app.get(
    "/journal",
    requirePermission({ accounting: ["list"] }),
    async (c) => {
      try {
        const query = parseJournalOperationsQuery(c.req.url);
        const result =
          await ctx.accountingModule.reports.queries.listOperationsWithLabels(
            query,
          );

        return jsonOk(
          c,
          {
            ...result,
            data: result.data.map((row) => ({
              ...row,
              postingDate: row.postingDate.toISOString(),
              postedAt: row.postedAt?.toISOString() ?? null,
              lastOutboxErrorAt: row.lastOutboxErrorAt?.toISOString() ?? null,
              createdAt: row.createdAt.toISOString(),
            })),
          },
        );
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.get(
    "/journal/:operationId",
    requirePermission({ accounting: ["list"] }),
    async (c) => {
      try {
        const { operationId } = OperationParamSchema.parse(c.req.param());
        const details =
          await ctx.accountingModule.reports.queries.getOperationDetailsWithLabels(
            operationId,
          );

        if (!details) {
          return c.json({ error: `Operation not found: ${operationId}` }, 404);
        }

        return c.json(mapOperationDetailsDto(details), 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  app.get("/", requirePermission({ documents: ["list"] }), async (c) => {
    try {
      const user = c.get("user")!;
      const query = ListDocumentsQuerySchema.parse(
        queryObjectFromUrl(c.req.url),
      );
      const actionPermissions = await resolveDocumentActionPermissions(user.id);
      const result = await ctx.documentsModule.documents.queries.list(
        query,
        user.id,
      );

      return c.json({
        ...result,
        data: result.data.map((item) =>
          toDocumentDto(
            withPublicAllowedActions({
              resource: item,
              role: user.role,
              actionPermissions,
            }),
          ),
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
        const result = await ctx.documentDraftWorkflow.createDraft({
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

  registerIdempotentMutationRoute({
    app,
    method: "patch",
    path: "/:docType/:id",
    permission: { documents: ["update"] },
    parseBody: async (c) => UpdateDocumentInputSchema.parse(await c.req.json()),
    handle: async ({
      c,
      body,
      actorUserId,
      idempotencyKey,
      requestContext,
    }) => {
      const docType = c.req.param("docType")!;
      const id = c.req.param("id")!;
      assertPublicMutationAllowed({
        docType,
        action: "update",
        role: c.get("user")?.role,
      });

      return ctx.documentsModule.documents.commands.updateDraft({
        docType,
        documentId: id,
        payload: body.input,
        actorUserId,
        idempotencyKey,
        requestContext,
      });
    },
    respond: (c, result) => jsonOk(c, toDocumentDto(result)),
    handleError: handleRouteError,
  });

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
        const result = await ctx.documentsModule.documents.queries.get(
          docType,
          id,
          user.id,
        );

        return c.json(
          toDocumentDto(
            withPublicAllowedActions({
              resource: result,
              role: user.role,
              actionPermissions,
            }),
          ),
        );
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
        const details = await ctx.documentsModule.documents.queries.getDetails(
          docType,
          id,
          user.id,
        );
        const [actionPermissions, ledgerOperationDetailsById] =
          await Promise.all([
            resolveDocumentActionPermissions(user.id),
            ctx.accountingModule.reports.queries.listOperationDetailsWithLabels(
              details.documentOperations.map(
                (operation) => operation.operationId,
              ),
            ),
          ]);
        const ledgerOperations = details.documentOperations.map((operation) => {
          const operationDetails = ledgerOperationDetailsById.get(
            operation.operationId,
          );

          return operationDetails
            ? mapOperationDetailsDto(operationDetails)
            : null;
        });

        return c.json(
          toDocumentDetailsDto(
            withPublicAllowedActions({
              resource: details,
              role: user.role,
              actionPermissions,
            }),
            {
              ledgerOperations,
            },
          ),
        );
      } catch (error) {
        return handleRouteError(c, error);
      }
    },
  );

  registerDocumentMutationAction({
    path: "/:docType/:id/submit",
    permission: "submit",
    action: "submit",
  });
  registerDocumentMutationAction({
    path: "/:docType/:id/approve",
    permission: "approve",
    action: "approve",
  });
  registerDocumentMutationAction({
    path: "/:docType/:id/reject",
    permission: "reject",
    action: "reject",
  });
  registerDocumentMutationAction({
    path: "/:docType/:id/post",
    permission: "post",
    action: "post",
  });
  registerDocumentMutationAction({
    path: "/:docType/:id/cancel",
    permission: "cancel",
    action: "cancel",
  });
  registerDocumentMutationAction({
    path: "/:docType/:id/repost",
    permission: "post",
    action: "repost",
  });

  return app;
}
