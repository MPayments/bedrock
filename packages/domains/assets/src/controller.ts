import { defineController, http, type DefinedController } from "@bedrock/core";
import { AuthContextToken, requirePermissionMiddleware } from "@bedrock/security";
import {
  ConflictHttpError,
  DeletedResponseSchema,
  IdParamSchema,
  NotFoundHttpError,
  replyDeleted,
} from "@multihansa/common/bedrock";
import { createPaginatedListSchema } from "@multihansa/common/pagination";

import { CurrencyOptionsResponseSchema } from "./contracts";
import { currenciesService } from "./service";
import {
  CreateCurrencyInputSchema,
  CurrencySchema,
  ListCurrenciesQuerySchema,
  UpdateCurrencyInputSchema,
} from "./validation";

const PaginatedCurrenciesSchema = createPaginatedListSchema(CurrencySchema);

export const currenciesController: DefinedController = defineController("currencies-http", {
  basePath: "/v1/currencies",
  deps: {
    auth: AuthContextToken,
  },
  ctx: ({ auth }) => ({ auth }),
  routes: ({ route }) => ({
    list: route.get({
      path: "/",
      request: {
        query: ListCurrenciesQuerySchema,
      },
      responses: {
        200: PaginatedCurrenciesSchema,
      },
      middleware: [requirePermissionMiddleware("currencies:list")],
      handler: currenciesService.actions.list,
    }),
    options: route.get({
      path: "/options",
      responses: {
        200: CurrencyOptionsResponseSchema,
      },
      middleware: [requirePermissionMiddleware("currencies:list")],
      handler: currenciesService.actions.options,
    }),
    create: route.post({
      path: "/",
      request: {
        body: CreateCurrencyInputSchema,
      },
      responses: {
        201: CurrencySchema,
      },
      middleware: [requirePermissionMiddleware("currencies:create")],
      handler: async ({ call, request }) =>
        http.reply.created(await call(currenciesService.actions.create, request.body)),
    }),
    get: route.get({
      path: "/:id",
      request: {
        params: IdParamSchema,
      },
      responses: {
        200: CurrencySchema,
      },
      middleware: [requirePermissionMiddleware("currencies:list")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) => call(currenciesService.actions.get, request.params),
    }),
    update: route.patch({
      path: "/:id",
      request: {
        params: IdParamSchema,
        body: UpdateCurrencyInputSchema,
      },
      responses: {
        200: CurrencySchema,
      },
      middleware: [requirePermissionMiddleware("currencies:update")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) =>
        call(currenciesService.actions.update, {
          id: request.params.id,
          input: request.body,
        }),
    }),
    delete: route.delete({
      path: "/:id",
      request: {
        params: IdParamSchema,
      },
      responses: {
        200: DeletedResponseSchema,
      },
      middleware: [requirePermissionMiddleware("currencies:delete")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
        MULTIHANSA_CONFLICT: ConflictHttpError,
      },
      handler: async ({ call, request }) => {
        await call(currenciesService.actions.delete, request.params);
        return replyDeleted();
      },
    }),
  }),
});
