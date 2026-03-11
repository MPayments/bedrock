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
  MissingIdempotencyKeyHttpError,
  NotFoundHttpError,
} from "@multihansa/common/bedrock";

import {
  BalanceMutationResultSchema,
  BalanceSnapshotSchema,
} from "./schemas";
import { balancesService } from "./service";

const BalanceSubjectParamsSchema = z.object({
  bookId: z.uuid(),
  subjectType: z.string().min(1),
  subjectId: z.string().min(1),
  currency: z.string().min(1),
});

const ReserveBalanceBodySchema = z.object({
  subject: BalanceSubjectParamsSchema.omit({
    bookId: true,
    subjectType: true,
    subjectId: true,
    currency: true,
  }).extend({
    bookId: z.uuid(),
    subjectType: z.string().min(1),
    subjectId: z.string().min(1),
    currency: z.string().min(1),
  }),
  amount: z.string().min(1),
  holdRef: z.string().min(1),
  reason: z.string().optional(),
});

const HoldActionBodySchema = z.object({
  subject: BalanceSubjectParamsSchema.omit({
    bookId: true,
    subjectType: true,
    subjectId: true,
    currency: true,
  }).extend({
    bookId: z.uuid(),
    subjectType: z.string().min(1),
    subjectId: z.string().min(1),
    currency: z.string().min(1),
  }),
  holdRef: z.string().min(1),
  reason: z.string().optional(),
});

const NotModifiedResponse: HttpEmptyResponseDescriptor = http.response.empty();

export const balancesController: DefinedController = defineController("balances-http", {
  basePath: "/v1/balances",
  deps: {
    auth: AuthContextToken,
  },
  ctx: ({ auth }) => ({ auth }),
  routes: ({ route }) => ({
    get: route.get({
      path: "/:bookId/:subjectType/:subjectId/:currency",
      request: {
        params: BalanceSubjectParamsSchema,
      },
      responses: {
        200: BalanceSnapshotSchema,
        304: NotModifiedResponse,
      },
      middleware: [requirePermissionMiddleware("balances:get")],
      handler: async ({ call, request }) => {
        const result = await call(balancesService.actions.get, request.params);
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
    reserve: route.post({
      path: "/reserve",
      request: {
        body: ReserveBalanceBodySchema,
      },
      responses: {
        200: BalanceMutationResultSchema,
      },
      middleware: [requirePermissionMiddleware("balances:reserve")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_CONFLICT: ConflictHttpError,
        MULTIHANSA_MISSING_IDEMPOTENCY_KEY: MissingIdempotencyKeyHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) => call(balancesService.actions.reserve, request.body),
    }),
    release: route.post({
      path: "/release",
      request: {
        body: HoldActionBodySchema,
      },
      responses: {
        200: BalanceMutationResultSchema,
      },
      middleware: [requirePermissionMiddleware("balances:release")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_CONFLICT: ConflictHttpError,
        MULTIHANSA_MISSING_IDEMPOTENCY_KEY: MissingIdempotencyKeyHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) => call(balancesService.actions.release, request.body),
    }),
    consume: route.post({
      path: "/consume",
      request: {
        body: HoldActionBodySchema,
      },
      responses: {
        200: BalanceMutationResultSchema,
      },
      middleware: [requirePermissionMiddleware("balances:consume")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_CONFLICT: ConflictHttpError,
        MULTIHANSA_MISSING_IDEMPOTENCY_KEY: MissingIdempotencyKeyHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) => call(balancesService.actions.consume, request.body),
    }),
  }),
});
