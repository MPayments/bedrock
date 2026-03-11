import { OpenAPIHono, z } from "@hono/zod-openapi";

import {
  CreateDocumentInputSchema,
  type DocumentAction,
  DocumentSystemOnlyTypeError,
  ListDocumentsQuerySchema,
  UpdateDocumentInputSchema,
  isSystemOnlyDocumentType,
} from "@multihansa/documents";
import type { DocumentTransitionAction } from "@multihansa/documents/runtime";
import { ListLedgerOperationsQuerySchema } from "@multihansa/ledger";

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

const OperationParamSchema = z.object({
  operationId: z.uuid(),
});

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

        return ctx.documentsService.transition({
          action: config.action,
          docType,
          documentId: id,
          actorUserId,
          idempotencyKey,
          requestContext,
        });
      },
      respond: (c, result) => jsonOk(c, toDocumentDto(result)),
      handleError: handleRouteError,
    });
  }

  app.get("/journal", requirePermission({ accounting: ["list"] }), async (c) => {
    try {
      const query = ListLedgerOperationsQuerySchema.parse(
        queryObjectFromUrl(c.req.url),
      );
      const result =
        await ctx.accountingReportingService.listOperationsWithLabels(query);

      return c.json(
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
        200,
      );
    } catch (error) {
      return handleRouteError(c, error);
    }
  });

  app.get(
    "/journal/:operationId",
    requirePermission({ accounting: ["list"] }),
    async (c) => {
      try {
        const { operationId } = OperationParamSchema.parse(c.req.param());
        const details =
          await ctx.accountingReportingService.getOperationDetailsWithLabels(
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
      const result = await ctx.documentsService.list(query, user.id);

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

      return ctx.documentsService.updateDraft({
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
        const result = await ctx.documentsService.get(docType, id, user.id);

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
        const details = await ctx.documentsService.getDetails(
          docType,
          id,
          user.id,
        );
        const actionPermissions = await resolveDocumentActionPermissions(
          user.id,
        );

        return c.json(
          toDocumentDetailsDto(
            withPublicAllowedActions({
              resource: details,
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
