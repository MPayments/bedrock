import { defineController, http, type DefinedController } from "@bedrock/core";
import { AuthContextToken, requirePermissionMiddleware } from "@bedrock/security";
import { createPaginatedListSchema } from "@multihansa/common/pagination";
import {
  CreateCustomerInputSchema,
  CustomerSchema,
  ListCustomersQuerySchema,
  UpdateCustomerInputSchema,
} from "@multihansa/parties/customers";

import { ConflictHttpError, NotFoundHttpError } from "@multihansa/common/bedrock";
import { replyDeleted } from "@multihansa/common/bedrock";
import { DeletedResponseSchema, IdParamSchema } from "@multihansa/common/bedrock";
import { customersService } from "./service";

const PaginatedCustomersSchema = createPaginatedListSchema(CustomerSchema);

export const customersController: DefinedController = defineController("customers-http", {
  basePath: "/v1/parties/customers",
  deps: {
    auth: AuthContextToken,
  },
  ctx: ({ auth }) => ({ auth }),
  routes: ({ route }) => ({
    list: route.get({
      path: "/",
      request: {
        query: ListCustomersQuerySchema,
      },
      responses: {
        200: PaginatedCustomersSchema,
      },
      middleware: [requirePermissionMiddleware("customers:list")],
      handler: customersService.actions.list,
    }),
    create: route.post({
      path: "/",
      request: {
        body: CreateCustomerInputSchema,
      },
      responses: {
        201: CustomerSchema,
      },
      middleware: [requirePermissionMiddleware("customers:create")],
      handler: async ({ call, request }) =>
        http.reply.created(await call(customersService.actions.create, request.body)),
    }),
    get: route.get({
      path: "/:id",
      request: {
        params: IdParamSchema,
      },
      responses: {
        200: CustomerSchema,
      },
      middleware: [requirePermissionMiddleware("customers:list")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) => call(customersService.actions.get, request.params),
    }),
    update: route.patch({
      path: "/:id",
      request: {
        params: IdParamSchema,
        body: UpdateCustomerInputSchema,
      },
      responses: {
        200: CustomerSchema,
      },
      middleware: [requirePermissionMiddleware("customers:update")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) =>
        call(customersService.actions.update, {
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
      middleware: [requirePermissionMiddleware("customers:delete")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
        MULTIHANSA_CONFLICT: ConflictHttpError,
      },
      handler: async ({ call, request }) => {
        await call(customersService.actions.delete, request.params);
        return replyDeleted();
      },
    }),
  }),
});
