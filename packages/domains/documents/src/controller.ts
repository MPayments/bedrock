import {
  defineController,
  http,
  type DefinedController,
  type HttpEmptyResponseDescriptor,
} from "@bedrock/core";
import { AuthContextToken, requirePermissionMiddleware } from "@bedrock/security";
import { z } from "zod";

import {
  BadRequestHttpError,
  ConflictHttpError,
  ForbiddenHttpError,
  MissingIdempotencyKeyHttpError,
  NotFoundHttpError,
} from "@multihansa/common/bedrock";
import { documentsService } from "./service";
import {
  DocumentDetailsSchema,
  DocumentSchema,
  DocumentsListResponseSchema,
} from "./schemas";
import {
  CreateDocumentInputSchema,
  ListDocumentsQuerySchema,
  UpdateDocumentInputSchema,
} from "./validation";

const DocumentTypeParamSchema = z.object({
  docType: z.string().min(1),
});

const DocumentParamsSchema = z.object({
  docType: z.string().min(1),
  id: z.uuid(),
});

const transitionRoutes = [
  {
    name: "submit",
    path: "/:docType/:id/submit",
    permission: "documents:submit",
    action: "submit" as const,
  },
  {
    name: "approve",
    path: "/:docType/:id/approve",
    permission: "documents:approve",
    action: "approve" as const,
  },
  {
    name: "reject",
    path: "/:docType/:id/reject",
    permission: "documents:reject",
    action: "reject" as const,
  },
  {
    name: "post",
    path: "/:docType/:id/post",
    permission: "documents:post",
    action: "post" as const,
  },
  {
    name: "cancel",
    path: "/:docType/:id/cancel",
    permission: "documents:cancel",
    action: "cancel" as const,
  },
  {
    name: "repost",
    path: "/:docType/:id/repost",
    permission: "documents:post",
    action: "repost" as const,
  },
] as const;

const NotModifiedResponse: HttpEmptyResponseDescriptor = http.response.empty();

export const documentsController: DefinedController = defineController("documents-http", {
  basePath: "/v1/documents",
  deps: {
    auth: AuthContextToken,
  },
  ctx: ({ auth }) => ({ auth }),
  routes: ({ route }) => ({
    list: route.get({
      path: "/",
      request: {
        query: ListDocumentsQuerySchema,
      },
      responses: {
        200: DocumentsListResponseSchema,
      },
      middleware: [requirePermissionMiddleware("documents:list")],
      handler: documentsService.actions.list,
    }),
    create: route.post({
      path: "/:docType",
      request: {
        params: DocumentTypeParamSchema,
        body: CreateDocumentInputSchema,
      },
      responses: {
        201: DocumentSchema,
      },
      middleware: [requirePermissionMiddleware("documents:create")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_CONFLICT: ConflictHttpError,
        MULTIHANSA_FORBIDDEN: ForbiddenHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: async ({ call, request }) =>
        http.reply.created(
          await call(documentsService.actions.create, {
            docType: request.params.docType,
            body: request.body,
          }),
        ),
    }),
    update: route.patch({
      path: "/:docType/:id",
      request: {
        params: DocumentParamsSchema,
        body: UpdateDocumentInputSchema,
      },
      responses: {
        200: DocumentSchema,
      },
      middleware: [requirePermissionMiddleware("documents:update")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_CONFLICT: ConflictHttpError,
        MULTIHANSA_FORBIDDEN: ForbiddenHttpError,
        MULTIHANSA_MISSING_IDEMPOTENCY_KEY: MissingIdempotencyKeyHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) =>
        call(documentsService.actions.update, {
          ...request.params,
          body: request.body,
        }),
    }),
    get: route.get({
      path: "/:docType/:id",
      request: {
        params: DocumentParamsSchema,
      },
      responses: {
        200: DocumentSchema,
        304: NotModifiedResponse,
      },
      middleware: [requirePermissionMiddleware("documents:get")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_CONFLICT: ConflictHttpError,
        MULTIHANSA_FORBIDDEN: ForbiddenHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: async ({ call, request }) => {
        const result = await call(documentsService.actions.get, request.params);
        const etag = `"${result.version}"`;

        if (request.headers["if-none-match"] === etag) {
          return http.reply.status(304, undefined, {
            headers: {
              etag,
              "cache-control": "no-cache",
            },
          });
        }

        return http.reply.status(200, result, {
          headers: {
            etag,
            "cache-control": "no-cache",
          },
        });
      },
    }),
    getDetails: route.get({
      path: "/:docType/:id/details",
      request: {
        params: DocumentParamsSchema,
      },
      responses: {
        200: DocumentDetailsSchema,
        304: NotModifiedResponse,
      },
      middleware: [requirePermissionMiddleware("documents:get")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_CONFLICT: ConflictHttpError,
        MULTIHANSA_FORBIDDEN: ForbiddenHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: async ({ call, request }) => {
        const result = await call(documentsService.actions.getDetails, request.params);
        const etag = `"${result.document.version}"`;

        if (request.headers["if-none-match"] === etag) {
          return http.reply.status(304, undefined, {
            headers: {
              etag,
              "cache-control": "no-cache",
            },
          });
        }

        return http.reply.status(200, result, {
          headers: {
            etag,
            "cache-control": "no-cache",
          },
        });
      },
    }),
    ...Object.fromEntries(
      transitionRoutes.map((config) => [
        config.name,
        route.post({
          path: config.path,
          request: {
            params: DocumentParamsSchema,
          },
          responses: {
            200: DocumentSchema,
          },
          middleware: [requirePermissionMiddleware(config.permission)],
          errors: {
            MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
            MULTIHANSA_CONFLICT: ConflictHttpError,
            MULTIHANSA_FORBIDDEN: ForbiddenHttpError,
            MULTIHANSA_MISSING_IDEMPOTENCY_KEY: MissingIdempotencyKeyHttpError,
            MULTIHANSA_NOT_FOUND: NotFoundHttpError,
          },
          handler: ({ call, request }) =>
            call(documentsService.actions.transition, {
              ...request.params,
              action: config.action,
            }),
        }),
      ]),
    ),
  }),
});
