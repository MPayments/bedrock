import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  AgreementDetailsSchema,
  CreateAgreementInputSchema,
  ListAgreementsQuerySchema,
  PaginatedAgreementsSchema,
  UpdateAgreementInputSchema,
} from "@bedrock/agreements/contracts";
import { FileAttachmentSchema } from "@bedrock/files/contracts";
import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";
import { PrintFormDescriptorSchema } from "@bedrock/workflow-document-generation";

import { DeletedSchema, ErrorSchema, IdParamSchema } from "../common";
import { handleRouteError } from "../common/errors";
import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { withRequiredIdempotency } from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";
import {
  PrintFormFormatQuerySchema,
  writeGeneratedDocumentResponse,
} from "./internal/print-forms";

export function agreementsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  async function assertAgreementVersion(input: {
    agreementId: string;
    versionId: string;
  }) {
    const agreement =
      await ctx.agreementsModule.agreements.queries.findById(input.agreementId);

    if (!agreement) {
      throw new NotFoundError("Agreement", input.agreementId);
    }

    if (agreement.currentVersion.id !== input.versionId) {
      throw new NotFoundError("Agreement version", input.versionId);
    }

    return agreement;
  }

  const listRoute = createRoute({
    middleware: [requirePermission({ agreements: ["list"] })],
    method: "get",
    path: "/",
    tags: ["Agreements"],
    summary: "List agreements",
    request: {
      query: ListAgreementsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: PaginatedAgreementsSchema,
          },
        },
        description: "Paginated agreements",
      },
    },
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ agreements: ["list"] })],
    method: "get",
    path: "/{id}",
    tags: ["Agreements"],
    summary: "Get agreement by id",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: AgreementDetailsSchema,
          },
        },
        description: "Agreement found",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Agreement not found",
      },
    },
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ agreements: ["create"] })],
    method: "post",
    path: "/",
    tags: ["Agreements"],
    summary: "Create agreement",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateAgreementInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: AgreementDetailsSchema,
          },
        },
        description: "Agreement created",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation or idempotency header error",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Referenced entity not found",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Idempotency conflict",
      },
    },
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ agreements: ["update"] })],
    method: "patch",
    path: "/{id}",
    tags: ["Agreements"],
    summary: "Update agreement version-owned terms",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateAgreementInputSchema,
          },
        },
        required: true,
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: AgreementDetailsSchema,
          },
        },
        description: "Agreement updated",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Validation or idempotency header error",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Agreement not found",
      },
      409: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Idempotency conflict",
      },
    },
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ agreements: ["delete"] })],
    method: "delete",
    path: "/{id}",
    tags: ["Agreements"],
    summary: "Archive agreement",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: DeletedSchema,
          },
        },
        description: "Agreement archived",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorSchema,
          },
        },
        description: "Agreement not found",
      },
    },
  });

  const listPrintFormsRoute = createRoute({
    middleware: [requirePermission({ agreements: ["list"] })],
    method: "get",
    path: "/{id}/versions/{versionId}/print-forms",
    tags: ["Agreements"],
    summary: "List agreement version print forms",
    request: {
      params: IdParamSchema.extend({
        versionId: z.string().uuid(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(PrintFormDescriptorSchema),
          },
        },
        description: "Agreement version print forms",
      },
    },
  });

  const downloadPrintFormRoute = createRoute({
    middleware: [requirePermission({ agreements: ["list"] })],
    method: "get",
    path: "/{id}/versions/{versionId}/print-forms/{formId}",
    tags: ["Agreements"],
    summary: "Download agreement version print form",
    request: {
      params: IdParamSchema.extend({
        formId: z.string().min(1),
        versionId: z.string().uuid(),
      }),
      query: PrintFormFormatQuerySchema,
    },
    responses: {
      200: { description: "Generated file" },
    },
  });

  const uploadSignedContractRoute = createRoute({
    middleware: [requirePermission({ agreements: ["update"] })],
    method: "post",
    path: "/{id}/versions/{versionId}/signed-contract",
    tags: ["Agreements"],
    summary: "Upload signed contract for an agreement version",
    request: {
      params: IdParamSchema.extend({
        versionId: z.string().uuid(),
      }),
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: FileAttachmentSchema,
          },
        },
        description: "Signed contract uploaded",
      },
    },
  });

  const getSignedContractRoute = createRoute({
    middleware: [requirePermission({ agreements: ["list"] })],
    method: "get",
    path: "/{id}/versions/{versionId}/signed-contract",
    tags: ["Agreements"],
    summary: "Get signed contract metadata for an agreement version",
    request: {
      params: IdParamSchema.extend({
        versionId: z.string().uuid(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: FileAttachmentSchema,
          },
        },
        description: "Signed contract metadata",
      },
    },
  });

  const downloadSignedContractRoute = createRoute({
    middleware: [requirePermission({ agreements: ["list"] })],
    method: "get",
    path: "/{id}/versions/{versionId}/signed-contract/download",
    tags: ["Agreements"],
    summary: "Download signed contract for an agreement version",
    request: {
      params: IdParamSchema.extend({
        versionId: z.string().uuid(),
      }),
    },
    responses: {
      302: {
        description: "Redirect to signed file URL",
      },
    },
  });

  return app
    .openapi(listRoute, async (c) => {
      try {
        const query = c.req.valid("query");
        const result = await ctx.agreementsModule.agreements.queries.list(query);
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(getRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const result = await ctx.agreementsModule.agreements.queries.findById(id);
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(createRoute_, async (c) => {
      try {
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.agreementsModule.agreements.commands.create({
            ...body,
            actorUserId: c.get("user")!.id,
            idempotencyKey,
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        return jsonOk(c, result, 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(updateRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        const body = c.req.valid("json");
        const result = await withRequiredIdempotency(c, (idempotencyKey) =>
          ctx.agreementsModule.agreements.commands.update({
            ...body,
            actorUserId: c.get("user")!.id,
            id,
            idempotencyKey,
          }),
        );

        if (result instanceof Response) {
          return result;
        }

        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(deleteRoute, async (c) => {
      try {
        const { id } = c.req.valid("param");
        await ctx.agreementsModule.agreements.commands.archive(id);
        return jsonOk(c, { deleted: true });
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listPrintFormsRoute, async (c) => {
      try {
        const { id, versionId } = c.req.valid("param");
        const result =
          await ctx.documentGenerationWorkflow.listAgreementVersionPrintForms({
          agreementId: id,
          versionId,
        });
        return jsonOk(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(downloadPrintFormRoute, async (c): Promise<any> => {
      try {
        const { formId, id, versionId } = c.req.valid("param");
        const { format } = c.req.valid("query");
        const result =
          await ctx.documentGenerationWorkflow.generateAgreementVersionPrintForm({
          agreementId: id,
          formId,
          format,
          versionId,
        });

        return writeGeneratedDocumentResponse(c, result);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(uploadSignedContractRoute, async (c) => {
      try {
        const { id, versionId } = c.req.valid("param");
        await assertAgreementVersion({ agreementId: id, versionId });

        let body: Awaited<ReturnType<typeof c.req.parseBody>>;
        try {
          body = await c.req.parseBody();
        } catch {
          throw new ValidationError("Invalid multipart form data");
        }

        const file = body.file;
        if (!file || typeof file === "string") {
          throw new ValidationError("File is required");
        }

        const result =
          await ctx.filesModule.files.commands.upsertAgreementVersionSignedContract(
            {
              buffer: Buffer.from(await file.arrayBuffer()),
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type || "application/octet-stream",
              uploadedBy: c.get("user")!.id,
              versionId,
            },
          );

        return jsonOk(c, result, 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(getSignedContractRoute, async (c) => {
      try {
        const { id, versionId } = c.req.valid("param");
        await assertAgreementVersion({ agreementId: id, versionId });
        const result =
          await ctx.filesModule.files.queries.findAgreementVersionSignedContract(
            versionId,
          );

        if (!result) {
          throw new NotFoundError("Signed contract", versionId);
        }

        return jsonOk(c, {
          id: result.id,
          fileName: result.fileName,
          fileSize: result.fileSize,
          mimeType: result.mimeType,
          purpose: result.attachmentPurpose,
          visibility: result.attachmentVisibility,
          uploadedBy: result.versionCreatedBy,
          description: result.description,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
        });
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(downloadSignedContractRoute, async (c) => {
      try {
        const { id, versionId } = c.req.valid("param");
        await assertAgreementVersion({ agreementId: id, versionId });
        const result =
          await ctx.filesModule.files.queries.findAgreementVersionSignedContract(
            versionId,
          );

        if (!result) {
          throw new NotFoundError("Signed contract", versionId);
        }

        const url =
          await ctx.filesModule.files.queries.getAgreementVersionSignedContractDownloadUrl(
            {
              fileAssetId: result.id,
              versionId,
            },
          );

        return c.redirect(url, 302);
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}
