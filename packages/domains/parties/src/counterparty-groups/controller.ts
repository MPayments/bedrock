import { defineController, http, type DefinedController } from "@bedrock/core";
import { AuthContextToken, requirePermissionMiddleware } from "@bedrock/security";
import {
  CounterpartyGroupSchema,
  CreateCounterpartyGroupInputSchema,
  ListCounterpartyGroupsQuerySchema,
  UpdateCounterpartyGroupInputSchema,
} from "@multihansa/parties/counterparties";
import { CounterpartyGroupOptionsResponseSchema } from "@multihansa/parties/counterparties/contracts";

import {
  BadRequestHttpError,
  ConflictHttpError,
  NotFoundHttpError,
} from "@multihansa/common/bedrock";
import { replyDeleted } from "@multihansa/common/bedrock";
import { DeletedResponseSchema, IdParamSchema } from "@multihansa/common/bedrock";
import { counterpartyGroupsService } from "./service";

export const counterpartyGroupsController: DefinedController = defineController(
  "counterparty-groups-http",
  {
    basePath: "/v1/counterparty-groups",
    deps: {
      auth: AuthContextToken,
    },
    ctx: ({ auth }) => ({ auth }),
    routes: ({ route }) => ({
      list: route.get({
        path: "/",
        request: {
          query: ListCounterpartyGroupsQuerySchema,
        },
        responses: {
          200: CounterpartyGroupSchema.array(),
        },
        middleware: [requirePermissionMiddleware("counterparties:list")],
        handler: counterpartyGroupsService.actions.list,
      }),
      options: route.get({
        path: "/options",
        responses: {
          200: CounterpartyGroupOptionsResponseSchema,
        },
        middleware: [requirePermissionMiddleware("counterparties:list")],
        handler: counterpartyGroupsService.actions.options,
      }),
      create: route.post({
        path: "/",
        request: {
          body: CreateCounterpartyGroupInputSchema,
        },
        responses: {
          201: CounterpartyGroupSchema,
        },
        middleware: [requirePermissionMiddleware("counterparties:create")],
        errors: {
          MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
          MULTIHANSA_NOT_FOUND: NotFoundHttpError,
        },
        handler: async ({ call, request }) =>
          http.reply.created(
            await call(counterpartyGroupsService.actions.create, request.body),
          ),
      }),
      update: route.patch({
        path: "/:id",
        request: {
          params: IdParamSchema,
          body: UpdateCounterpartyGroupInputSchema,
        },
        responses: {
          200: CounterpartyGroupSchema,
        },
        middleware: [requirePermissionMiddleware("counterparties:update")],
        errors: {
          MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
          MULTIHANSA_NOT_FOUND: NotFoundHttpError,
        },
        handler: ({ call, request }) =>
          call(counterpartyGroupsService.actions.update, {
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
          MULTIHANSA_CONFLICT: ConflictHttpError,
          MULTIHANSA_NOT_FOUND: NotFoundHttpError,
        },
        handler: async ({ call, request }) => {
          await call(counterpartyGroupsService.actions.delete, request.params);
          return replyDeleted();
        },
      }),
    }),
  },
);
