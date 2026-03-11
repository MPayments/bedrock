import { defineController, http, type DefinedController } from "@bedrock/core";
import { AuthContextToken, requirePermissionMiddleware } from "@bedrock/security";
import { createPaginatedListSchema } from "@multihansa/common/pagination";
import {
  CreateRequisiteProviderInputSchema,
  ListRequisiteProvidersQuerySchema,
  RequisiteProviderSchema,
  UpdateRequisiteProviderInputSchema,
} from "@multihansa/parties/requisite-providers";
import { RequisiteProviderOptionsResponseSchema } from "@multihansa/parties/requisite-providers/contracts";

import { BadRequestHttpError, NotFoundHttpError } from "@multihansa/common/bedrock";
import { replyDeleted } from "@multihansa/common/bedrock";
import { DeletedResponseSchema, IdParamSchema } from "@multihansa/common/bedrock";
import { requisiteProvidersService } from "./service";

const PaginatedRequisiteProvidersSchema = createPaginatedListSchema(
  RequisiteProviderSchema,
);

export const requisiteProvidersController: DefinedController = defineController(
  "requisite-providers-http",
  {
    basePath: "/v1/parties/requisite-providers",
    deps: {
      auth: AuthContextToken,
    },
    ctx: ({ auth }) => ({ auth }),
    routes: ({ route }) => ({
      list: route.get({
        path: "/",
        request: {
          query: ListRequisiteProvidersQuerySchema,
        },
        responses: {
          200: PaginatedRequisiteProvidersSchema,
        },
        middleware: [requirePermissionMiddleware("requisite_providers:list")],
        handler: requisiteProvidersService.actions.list,
      }),
      options: route.get({
        path: "/options",
        responses: {
          200: RequisiteProviderOptionsResponseSchema,
        },
        middleware: [requirePermissionMiddleware("requisite_providers:list")],
        handler: requisiteProvidersService.actions.options,
      }),
      create: route.post({
        path: "/",
        request: {
          body: CreateRequisiteProviderInputSchema,
        },
        responses: {
          201: RequisiteProviderSchema,
        },
        middleware: [requirePermissionMiddleware("requisite_providers:create")],
        errors: {
          MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        },
        handler: async ({ call, request }) =>
          http.reply.created(
            await call(requisiteProvidersService.actions.create, request.body),
          ),
      }),
      get: route.get({
        path: "/:id",
        request: {
          params: IdParamSchema,
        },
        responses: {
          200: RequisiteProviderSchema,
        },
        middleware: [requirePermissionMiddleware("requisite_providers:list")],
        errors: {
          MULTIHANSA_NOT_FOUND: NotFoundHttpError,
        },
        handler: ({ call, request }) =>
          call(requisiteProvidersService.actions.get, request.params),
      }),
      update: route.patch({
        path: "/:id",
        request: {
          params: IdParamSchema,
          body: UpdateRequisiteProviderInputSchema,
        },
        responses: {
          200: RequisiteProviderSchema,
        },
        middleware: [requirePermissionMiddleware("requisite_providers:update")],
        errors: {
          MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
          MULTIHANSA_NOT_FOUND: NotFoundHttpError,
        },
        handler: ({ call, request }) =>
          call(requisiteProvidersService.actions.update, {
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
        middleware: [requirePermissionMiddleware("requisite_providers:delete")],
        errors: {
          MULTIHANSA_NOT_FOUND: NotFoundHttpError,
        },
        handler: async ({ call, request }) => {
          await call(requisiteProvidersService.actions.delete, request.params);
          return replyDeleted();
        },
      }),
    }),
  },
);
