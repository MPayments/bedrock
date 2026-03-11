import { defineController, http, type DefinedController } from "@bedrock/core";
import { AuthContextToken, requirePermissionMiddleware } from "@bedrock/security";
import { createPaginatedListSchema } from "@multihansa/common/pagination";
import {
  CreateOrganizationInputSchema,
  ListOrganizationsQuerySchema,
  OrganizationSchema,
  UpdateOrganizationInputSchema,
} from "@multihansa/parties/organizations";
import { OrganizationOptionsResponseSchema } from "@multihansa/parties/organizations/contracts";

import {
  BadRequestHttpError,
  ConflictHttpError,
  NotFoundHttpError,
} from "@multihansa/common/bedrock";
import { replyDeleted } from "@multihansa/common/bedrock";
import { DeletedResponseSchema, IdParamSchema } from "@multihansa/common/bedrock";
import { organizationsService } from "./service";

const PaginatedOrganizationsSchema = createPaginatedListSchema(OrganizationSchema);

export const organizationsController: DefinedController = defineController("organizations-http", {
  basePath: "/v1/parties/organizations",
  deps: {
    auth: AuthContextToken,
  },
  ctx: ({ auth }) => ({ auth }),
  routes: ({ route }) => ({
    list: route.get({
      path: "/",
      request: {
        query: ListOrganizationsQuerySchema,
      },
      responses: {
        200: PaginatedOrganizationsSchema,
      },
      middleware: [requirePermissionMiddleware("organizations:list")],
      handler: organizationsService.actions.list,
    }),
    options: route.get({
      path: "/options",
      responses: {
        200: OrganizationOptionsResponseSchema,
      },
      middleware: [requirePermissionMiddleware("organizations:list")],
      handler: organizationsService.actions.options,
    }),
    create: route.post({
      path: "/",
      request: {
        body: CreateOrganizationInputSchema,
      },
      responses: {
        201: OrganizationSchema,
      },
      middleware: [requirePermissionMiddleware("organizations:create")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
      },
      handler: async ({ call, request }) =>
        http.reply.created(await call(organizationsService.actions.create, request.body)),
    }),
    get: route.get({
      path: "/:id",
      request: {
        params: IdParamSchema,
      },
      responses: {
        200: OrganizationSchema,
      },
      middleware: [requirePermissionMiddleware("organizations:list")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) =>
        call(organizationsService.actions.get, request.params),
    }),
    update: route.patch({
      path: "/:id",
      request: {
        params: IdParamSchema,
        body: UpdateOrganizationInputSchema,
      },
      responses: {
        200: OrganizationSchema,
      },
      middleware: [requirePermissionMiddleware("organizations:update")],
      errors: {
        MULTIHANSA_BAD_REQUEST: BadRequestHttpError,
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
      },
      handler: ({ call, request }) =>
        call(organizationsService.actions.update, {
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
      middleware: [requirePermissionMiddleware("organizations:delete")],
      errors: {
        MULTIHANSA_NOT_FOUND: NotFoundHttpError,
        MULTIHANSA_CONFLICT: ConflictHttpError,
      },
      handler: async ({ call, request }) => {
        await call(organizationsService.actions.delete, request.params);
        return replyDeleted();
      },
    }),
  }),
});
