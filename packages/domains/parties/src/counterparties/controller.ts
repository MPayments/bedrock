import { defineController, http, type DefinedController } from "@bedrock/core";
import { AuthContextToken, requirePermissionMiddleware } from "@bedrock/security";
import { createPaginatedListSchema } from "@multihansa/common/pagination";
import {
  CounterpartySchema,
  CreateCounterpartyInputSchema,
  ListCounterpartiesQuerySchema,
  UpdateCounterpartyInputSchema,
} from "@multihansa/parties/counterparties";
import { CounterpartyOptionsResponseSchema } from "@multihansa/parties/counterparties/contracts";

import { BadRequestHttpError, NotFoundHttpError } from "@multihansa/common/bedrock";
import { replyDeleted } from "@multihansa/common/bedrock";
import { DeletedResponseSchema, IdParamSchema } from "@multihansa/common/bedrock";
import { counterpartiesService } from "./service";

const PaginatedCounterpartiesSchema = createPaginatedListSchema(
  CounterpartySchema,
);

export const counterpartiesController: DefinedController = defineController("counterparties-http", {
  basePath: "/v1/parties/counterparties",
  deps: {
    auth: AuthContextToken,
  },
  ctx: ({ auth }) => ({ auth }),
  routes: ({ route }) => ({
    list: route.get({
      path: "/",
      request: {
        query: ListCounterpartiesQuerySchema,
      },
      responses: {
        200: PaginatedCounterpartiesSchema,
      },
      middleware: [requirePermissionMiddleware("counterparties:list")],
      handler: counterpartiesService.actions.list,
    }),
    options: route.get({
      path: "/options",
      responses: {
        200: CounterpartyOptionsResponseSchema,
      },
      middleware: [requirePermissionMiddleware("counterparties:list")],
      handler: counterpartiesService.actions.options,
    }),
    create: route.post({
      path: "/",
      request: {
        body: CreateCounterpartyInputSchema,
      },
      responses: {
        201: CounterpartySchema,
      },
      middleware: [requirePermissionMiddleware("counterparties:create")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: async ({ call, request }) =>
        http.reply.created(await call(counterpartiesService.actions.create, request.body)),
    }),
    get: route.get({
      path: "/:id",
      request: {
        params: IdParamSchema,
      },
      responses: {
        200: CounterpartySchema,
      },
      middleware: [requirePermissionMiddleware("counterparties:list")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) => call(counterpartiesService.actions.get, request.params),
    }),
    update: route.patch({
      path: "/:id",
      request: {
        params: IdParamSchema,
        body: UpdateCounterpartyInputSchema,
      },
      responses: {
        200: CounterpartySchema,
      },
      middleware: [requirePermissionMiddleware("counterparties:update")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) =>
        call(counterpartiesService.actions.update, {
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
      middleware: [requirePermissionMiddleware("counterparties:delete")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: async ({ call, request }) => {
        await call(counterpartiesService.actions.delete, request.params);
        return replyDeleted();
      },
    }),
  }),
});
