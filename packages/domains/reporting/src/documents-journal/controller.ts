import { defineController, type DefinedController } from "@bedrock/core";
import { AuthContextToken, requirePermissionMiddleware } from "@bedrock/security";
import { ListLedgerOperationsQuerySchema } from "@multihansa/ledger";
import { NotFoundHttpError } from "@multihansa/common/bedrock";
import {
  OperationDetailsSchema,
  OperationsListResponseSchema,
} from "@multihansa/documents";
import { z } from "zod";

import { documentsJournalService } from "./service";

const JournalOperationParamsSchema = z.object({
  operationId: z.uuid(),
});

export const documentsJournalController: DefinedController = defineController(
  "documents-journal-http",
  {
    basePath: "/v1/documents",
    deps: {
      auth: AuthContextToken,
    },
    ctx: ({ auth }) => ({ auth }),
    routes: ({ route }) => ({
      journal: route.get({
        path: "/journal",
        request: {
          query: ListLedgerOperationsQuerySchema,
        },
        responses: {
          200: OperationsListResponseSchema,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        handler: documentsJournalService.actions.journal,
      }),
      getJournalOperation: route.get({
        path: "/journal/:operationId",
        request: {
          params: JournalOperationParamsSchema,
        },
        responses: {
          200: OperationDetailsSchema,
        },
        middleware: [requirePermissionMiddleware("accounting:list")],
        errors: {
          MULTIHANSA_NOT_FOUND: NotFoundHttpError,
        },
        handler: ({ call, request }) =>
          call(documentsJournalService.actions.getJournalOperation, request.params),
      }),
    }),
  },
);
