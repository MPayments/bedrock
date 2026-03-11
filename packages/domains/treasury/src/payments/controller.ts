import { defineController, http, type DefinedController } from "@bedrock/core";
import { AuthContextToken, requirePermissionMiddleware } from "@bedrock/security";
import { z } from "zod";

import {
  PaymentDetailsSchema,
  PaymentListResponseSchema,
} from "./schemas";
import { paymentsService } from "./service";
import {
  BadRequestHttpError,
  ConflictHttpError,
  ForbiddenHttpError,
  MissingIdempotencyKeyHttpError,
  NotFoundHttpError,
} from "@multihansa/common/bedrock";
import { DocumentSchema } from "@multihansa/documents";

const CreatePaymentInputSchema = z.object({
  createIdempotencyKey: z.string().trim().min(1).max(255),
  input: z.unknown(),
});

const ListPaymentsQuerySchema = z.object({
  kind: z.enum(["intent", "resolution", "all"]).default("intent"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const PaymentIdParamSchema = z.object({
  id: z.uuid(),
});

const paymentTransitions = [
  { name: "submit", path: "/:id/submit", permission: "payments:submit", action: "submit" as const },
  { name: "approve", path: "/:id/approve", permission: "payments:approve", action: "approve" as const },
  { name: "reject", path: "/:id/reject", permission: "payments:reject", action: "reject" as const },
  { name: "post", path: "/:id/post", permission: "payments:post", action: "post" as const },
  { name: "cancel", path: "/:id/cancel", permission: "payments:cancel", action: "cancel" as const },
] as const;

export const paymentsController: DefinedController = defineController("payments-http", {
  basePath: "/v1/treasury/payments",
  deps: {
    auth: AuthContextToken,
  },
  ctx: ({ auth }) => ({ auth }),
  routes: ({ route }) => ({
    list: route.get({
      path: "/",
      request: {
        query: ListPaymentsQuerySchema,
      },
      responses: {
        200: PaymentListResponseSchema,
      },
      middleware: [requirePermissionMiddleware("payments:list")],
      handler: paymentsService.actions.list,
    }),
    create: route.post({
      path: "/",
      request: {
        body: CreatePaymentInputSchema,
      },
      responses: {
        201: DocumentSchema,
      },
      middleware: [requirePermissionMiddleware("payments:create")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_CONFLICT: ConflictHttpError,
        MULTIHANSA_FORBIDDEN: ForbiddenHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: async ({ call, request }) =>
        http.reply.created(await call(paymentsService.actions.create, request.body)),
    }),
    get: route.get({
      path: "/:id",
      request: {
        params: PaymentIdParamSchema,
      },
      responses: {
        200: DocumentSchema,
      },
      middleware: [requirePermissionMiddleware("payments:get")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_CONFLICT: ConflictHttpError,
        MULTIHANSA_FORBIDDEN: ForbiddenHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) => call(paymentsService.actions.get, request.params),
    }),
    getDetails: route.get({
      path: "/:id/details",
      request: {
        params: PaymentIdParamSchema,
      },
      responses: {
        200: PaymentDetailsSchema,
      },
      middleware: [requirePermissionMiddleware("payments:get")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_CONFLICT: ConflictHttpError,
        MULTIHANSA_FORBIDDEN: ForbiddenHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) =>
        call(paymentsService.actions.getDetails, request.params),
    }),
    ...Object.fromEntries(
      paymentTransitions.map((config) => [
        config.name,
        route.post({
          path: config.path,
          request: {
            params: PaymentIdParamSchema,
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
            call(paymentsService.actions.transition, {
              ...request.params,
              action: config.action,
            }),
        }),
      ]),
    ),
  }),
});
