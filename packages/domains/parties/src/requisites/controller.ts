import { defineController, http, type DefinedController } from "@bedrock/core";
import { AuthContextToken, requirePermissionMiddleware } from "@bedrock/security";
import { createPaginatedListSchema } from "@multihansa/common/pagination";
import {
  CreateRequisiteInputSchema,
  ListRequisiteOptionsQuerySchema,
  ListRequisitesQuerySchema,
  RequisiteSchema,
  UpdateRequisiteInputSchema,
  UpsertRequisiteAccountingBindingInputSchema,
} from "@multihansa/parties/requisites";
import {
  RequisiteAccountingBindingSchema,
  RequisiteOptionsResponseSchema,
} from "@multihansa/parties/requisites/contracts";

import { BadRequestHttpError, NotFoundHttpError } from "@multihansa/common/bedrock";
import { replyDeleted } from "@multihansa/common/bedrock";
import { DeletedResponseSchema, IdParamSchema } from "@multihansa/common/bedrock";
import { requisitesService } from "./service";

const PaginatedRequisitesSchema = createPaginatedListSchema(RequisiteSchema);

export const requisitesController: DefinedController = defineController("requisites-http", {
  basePath: "/v1/parties/requisites",
  deps: {
    auth: AuthContextToken,
  },
  ctx: ({ auth }) => ({ auth }),
  routes: ({ route }) => ({
    list: route.get({
      path: "/",
      request: {
        query: ListRequisitesQuerySchema,
      },
      responses: {
        200: PaginatedRequisitesSchema,
      },
      middleware: [requirePermissionMiddleware("requisites:list")],
      handler: requisitesService.actions.list,
    }),
    options: route.get({
      path: "/options",
      request: {
        query: ListRequisiteOptionsQuerySchema,
      },
      responses: {
        200: RequisiteOptionsResponseSchema,
      },
      middleware: [requirePermissionMiddleware("requisites:list")],
      handler: requisitesService.actions.options,
    }),
    create: route.post({
      path: "/",
      request: {
        body: CreateRequisiteInputSchema,
      },
      responses: {
        201: RequisiteSchema,
      },
      middleware: [requirePermissionMiddleware("requisites:create")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: async ({ call, request }) =>
        http.reply.created(await call(requisitesService.actions.create, request.body)),
    }),
    get: route.get({
      path: "/:id",
      request: {
        params: IdParamSchema,
      },
      responses: {
        200: RequisiteSchema,
      },
      middleware: [requirePermissionMiddleware("requisites:list")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) => call(requisitesService.actions.get, request.params),
    }),
    update: route.patch({
      path: "/:id",
      request: {
        params: IdParamSchema,
        body: UpdateRequisiteInputSchema,
      },
      responses: {
        200: RequisiteSchema,
      },
      middleware: [requirePermissionMiddleware("requisites:update")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) =>
        call(requisitesService.actions.update, {
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
      middleware: [requirePermissionMiddleware("requisites:delete")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: async ({ call, request }) => {
        await call(requisitesService.actions.delete, request.params);
        return replyDeleted();
      },
    }),
    getBinding: route.get({
      path: "/:id/binding",
      request: {
        params: IdParamSchema,
      },
      responses: {
        200: RequisiteAccountingBindingSchema,
      },
      middleware: [requirePermissionMiddleware("requisites:list")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) =>
        call(requisitesService.actions.getBinding, request.params),
    }),
    upsertBinding: route.put({
      path: "/:id/binding",
      request: {
        params: IdParamSchema,
        body: UpsertRequisiteAccountingBindingInputSchema,
      },
      responses: {
        200: RequisiteAccountingBindingSchema,
      },
      middleware: [requirePermissionMiddleware("requisites:configure_binding")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) =>
        call(requisitesService.actions.upsertBinding, {
          id: request.params.id,
          input: request.body,
        }),
    }),
  }),
});
