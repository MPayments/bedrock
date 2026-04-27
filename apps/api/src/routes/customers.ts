import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import ExcelJS from "exceljs";

import {
  CustomerDeleteConflictError,
  CustomerNotFoundError,
} from "@bedrock/parties";
import {
  CreateCustomerInputSchema,
  CustomerOptionSchema,
  CustomerOptionsResponseSchema,
  CustomerSchema,
  ListCustomersQuerySchema,
  PaginatedCustomersSchema,
  UpdateCustomerInputSchema,
} from "@bedrock/parties/contracts";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import { ValidationError } from "@bedrock/shared/core/errors";

import {
  assertCustomerOwnsCounterparty,
  createCustomerAgreementForCustomer,
  CustomerAgreementSchema,
  resolveEffectiveCustomerAgreementByCustomerId,
  updateCustomerAgreement,
} from "./customer-agreements";
import {
  CustomerFileAttachmentSchema,
  serializeCustomerFileAttachment,
} from "./customer-files";
import { DeletedSchema, ErrorSchema } from "../common";
import { handleRouteError } from "../common/errors";
import { buildOptionsResponse } from "../common/options";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { withRequiredIdempotency } from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";

const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, name: "Calibri", size: 11 },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } },
};

const CustomerIdParamSchema = z.object({
  id: z
    .string()
    .uuid()
    .openapi({
      param: {
        in: "path",
        name: "id",
      },
    }),
});

const CustomerCounterpartyParamsSchema = z.object({
  counterpartyId: z
    .string()
    .uuid()
    .openapi({
      param: {
        in: "path",
        name: "counterpartyId",
      },
    }),
  customerId: z
    .string()
    .uuid()
    .openapi({
      param: {
        in: "path",
        name: "customerId",
      },
    }),
});

const CustomerCounterpartyDocumentParamsSchema =
  CustomerCounterpartyParamsSchema.extend({
    documentId: z
      .string()
      .uuid()
      .openapi({
        param: {
          in: "path",
          name: "documentId",
        },
      }),
  });

const CustomerAgreementUpsertInputSchema = z.object({
  agentFee: z.string().optional(),
  contractDate: z.string().optional(),
  contractNumber: z.string().optional(),
  fixedFee: z.string().optional(),
  organizationId: z.string().uuid(),
  organizationRequisiteId: z.string().uuid(),
});

const CUSTOMER_EXPORT_COLUMNS: {
  header: string;
  key: keyof CustomerExportRow;
}[] = [
  { header: "ID", key: "id" },
  { header: "Название", key: "name" },
  { header: "Внешний референс", key: "externalRef" },
  { header: "Описание", key: "description" },
  { header: "Создан", key: "createdAt" },
  { header: "Обновлен", key: "updatedAt" },
];

interface CustomerExportRow {
  id: string;
  name: string;
  externalRef: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toExportRow(customer: z.infer<typeof CustomerSchema>): CustomerExportRow {
  return {
    id: customer.id,
    name: customer.name,
    externalRef: customer.externalRef,
    description: customer.description,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

function applyWorksheetDefaults(worksheet: ExcelJS.Worksheet) {
  if (HEADER_STYLE.font) {
    worksheet.getRow(1).font = HEADER_STYLE.font;
  }

  if (HEADER_STYLE.fill) {
    worksheet.getRow(1).fill = HEADER_STYLE.fill;
  }

  worksheet.columns.forEach((column) => {
    column.width = Math.max(column.header?.toString().length ?? 0, 20);
  });
}

async function exportCustomersXlsx(ctx: AppContext) {
  const result = await ctx.partiesModule.customers.queries.list({
    limit: 50000,
    offset: 0,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Клиенты");

  worksheet.columns = CUSTOMER_EXPORT_COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
  }));

  for (const customer of result.data) {
    worksheet.addRow(toExportRow(customer));
  }

  applyWorksheetDefaults(worksheet);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}

function xlsxFilename(prefix: string) {
  return `${prefix}-${formatDate(new Date())}.xlsx`;
}

export function customersRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ customers: ["list"] })],
    method: "get",
    path: "/",
    request: { query: ListCustomersQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: PaginatedCustomersSchema },
        },
        description: "Paginated list of customers",
      },
    },
    summary: "List customers",
    tags: ["Customers"],
  });

  const exportRoute = createRoute({
    middleware: [requirePermission({ customers: ["list"] })],
    method: "get",
    path: "/export/xlsx",
    responses: { 200: { description: "Customers XLSX file" } },
    summary: "Export customers to XLSX",
    tags: ["Customers"],
  });

  const optionsRoute = createRoute({
    middleware: [requirePermission({ customers: ["list"] })],
    method: "get",
    path: "/options",
    responses: {
      200: {
        content: {
          "application/json": { schema: CustomerOptionsResponseSchema },
        },
        description: "Customer option list",
      },
    },
    summary: "List customers for select inputs",
    tags: ["Customers"],
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ customers: ["list"] })],
    method: "get",
    path: "/{id}",
    request: { params: CustomerIdParamSchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: CustomerSchema },
        },
        description: "Customer detail",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Customer not found",
      },
    },
    summary: "Get customer by id",
    tags: ["Customers"],
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ customers: ["create"] })],
    method: "post",
    path: "/",
    request: {
      body: {
        content: {
          "application/json": { schema: CreateCustomerInputSchema },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: {
          "application/json": { schema: CustomerSchema },
        },
        description: "Customer created",
      },
    },
    summary: "Create customer",
    tags: ["Customers"],
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ customers: ["update"] })],
    method: "patch",
    path: "/{id}",
    request: {
      body: {
        content: {
          "application/json": { schema: UpdateCustomerInputSchema },
        },
        required: true,
      },
      params: CustomerIdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": { schema: CustomerSchema },
        },
        description: "Customer updated",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Customer not found",
      },
    },
    summary: "Update customer",
    tags: ["Customers"],
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ customers: ["delete"] })],
    method: "delete",
    path: "/{id}",
    request: { params: CustomerIdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: DeletedSchema } },
        description: "Customer deleted",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Customer not found",
      },
      409: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Customer delete conflict",
      },
    },
    summary: "Delete customer",
    tags: ["Customers"],
  });

  const listCounterpartyDocumentsRoute = createRoute({
    middleware: [requirePermission({ customers: ["list"] })],
    method: "get",
    path: "/{customerId}/counterparties/{counterpartyId}/documents",
    request: { params: CustomerCounterpartyParamsSchema },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(CustomerFileAttachmentSchema),
          },
        },
        description: "Counterparty documents",
      },
    },
    summary: "List documents for a customer-owned counterparty",
    tags: ["Customers"],
  });

  const uploadCounterpartyDocumentRoute = createRoute({
    middleware: [requirePermission({ customers: ["update"] })],
    method: "post",
    path: "/{customerId}/counterparties/{counterpartyId}/documents",
    request: { params: CustomerCounterpartyParamsSchema },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: CustomerFileAttachmentSchema,
          },
        },
        description: "Document uploaded",
      },
    },
    summary: "Upload document for a customer-owned counterparty",
    tags: ["Customers"],
  });

  const downloadCounterpartyDocumentRoute = createRoute({
    middleware: [requirePermission({ customers: ["list"] })],
    method: "get",
    path: "/{customerId}/counterparties/{counterpartyId}/documents/{documentId}/download",
    request: { params: CustomerCounterpartyDocumentParamsSchema },
    responses: {
      200: { description: "Redirect to signed URL" },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Document not found",
      },
    },
    summary: "Download a customer-owned counterparty document",
    tags: ["Customers"],
  });

  const deleteCounterpartyDocumentRoute = createRoute({
    middleware: [requirePermission({ customers: ["update"] })],
    method: "delete",
    path: "/{customerId}/counterparties/{counterpartyId}/documents/{documentId}",
    request: { params: CustomerCounterpartyDocumentParamsSchema },
    responses: {
      200: {
        content: { "application/json": { schema: DeletedSchema } },
        description: "Document deleted",
      },
    },
    summary: "Delete a customer-owned counterparty document",
    tags: ["Customers"],
  });

  const upsertCounterpartyContractRoute = createRoute({
    middleware: [requirePermission({ agreements: ["create", "update"] })],
    method: "post",
    path: "/{customerId}/counterparties/{counterpartyId}/contract",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CustomerAgreementUpsertInputSchema,
          },
        },
        required: true,
      },
      params: CustomerCounterpartyParamsSchema,
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: CustomerAgreementSchema,
          },
        },
        description: "Contract created or updated",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Counterparty not found",
      },
    },
    summary: "Create or update contract for a customer-owned counterparty",
    tags: ["Customers"],
  });

  return app
    .openapi(exportRoute, async () => {
      const buffer = await exportCustomersXlsx(ctx);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Disposition": `attachment; filename="${xlsxFilename("customers")}"`,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        status: 200,
      });
    })
    .openapi(optionsRoute, async (c) => {
      const result = await ctx.partiesModule.customers.queries.list({
        limit: MAX_QUERY_LIST_LIMIT,
        offset: 0,
        sortBy: "name",
        sortOrder: "asc",
      });

      return c.json(
        buildOptionsResponse(result, (customer) =>
          CustomerOptionSchema.parse({
            id: customer.id,
            label: customer.name,
            name: customer.name,
          }),
        ),
        200,
      );
    })
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await ctx.partiesModule.customers.queries.list(query);
      return c.json(result, 200);
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const customer = await ctx.partiesModule.customers.queries.findById(id);
        return c.json(customer, 200);
      } catch (error) {
        if (error instanceof CustomerNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const customer = await ctx.partiesModule.customers.commands.create(input);
      return c.json(customer, 201);
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const customer = await ctx.partiesModule.customers.commands.update(
          id,
          input,
        );
        return c.json(customer, 200);
      } catch (error) {
        if (error instanceof CustomerNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    })
    .openapi(deleteRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        await ctx.partiesModule.customers.commands.remove(id);
        return c.json({ deleted: true }, 200);
      } catch (error) {
        if (error instanceof CustomerNotFoundError) {
          return c.json({ error: error.message }, 404);
        }
        if (error instanceof CustomerDeleteConflictError) {
          return c.json({ error: error.message }, 409);
        }

        throw error;
      }
    })
    .openapi(listCounterpartyDocumentsRoute, async (c) => {
      try {
        const { counterpartyId, customerId } = c.req.valid("param");
        await assertCustomerOwnsCounterparty(ctx, {
          counterpartyId,
          customerId,
        });
        const result =
          await ctx.filesModule.files.queries.listCounterpartyAttachments(
            counterpartyId,
          );
        return c.json(result.map(serializeCustomerFileAttachment), 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(uploadCounterpartyDocumentRoute, async (c) => {
      let customerId: string | null = null;
      let counterpartyId: string | null = null;

      try {
        ({ counterpartyId, customerId } = c.req.valid("param"));
        await assertCustomerOwnsCounterparty(ctx, {
          counterpartyId,
          customerId,
        });
        let body: Awaited<ReturnType<typeof c.req.parseBody>>;
        try {
          body = await c.req.parseBody();
        } catch {
          throw new ValidationError("Invalid multipart form data");
        }

        const file = body.file;
        if (!file || typeof file === "string") {
          return c.json({ error: "File is required" }, 400 as const);
        }

        const sessionUser = c.get("user")!;
        let buffer: Buffer;
        try {
          buffer = Buffer.from(await file.arrayBuffer());
        } catch {
          throw new ValidationError("Uploaded file could not be read");
        }

        const result =
          await ctx.filesModule.files.commands.uploadCounterpartyAttachment({
            buffer,
            description:
              typeof body.description === "string" ? body.description : null,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || "application/octet-stream",
            ownerId: counterpartyId,
            uploadedBy: sessionUser.id,
          });
        return c.json(serializeCustomerFileAttachment(result), 201);
      } catch (error) {
        if (!(error instanceof ValidationError)) {
          ctx.logger.error("Customer counterparty document upload failed", {
            counterpartyId,
            customerId,
            error: error instanceof Error ? error.message : String(error),
            userId: c.get("user")?.id ?? null,
          });
        }

        return handleRouteError(c, error);
      }
    })
    .openapi(downloadCounterpartyDocumentRoute, async (c) => {
      try {
        const { counterpartyId, customerId, documentId } = c.req.valid("param");
        await assertCustomerOwnsCounterparty(ctx, {
          counterpartyId,
          customerId,
        });
        const url =
          await ctx.filesModule.files.queries.getCounterpartyAttachmentDownloadUrl(
            {
              fileAssetId: documentId,
              ownerId: counterpartyId,
            },
          );

        return c.redirect(url, 302);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(deleteCounterpartyDocumentRoute, async (c) => {
      try {
        const { counterpartyId, customerId, documentId } = c.req.valid("param");
        await assertCustomerOwnsCounterparty(ctx, {
          counterpartyId,
          customerId,
        });
        await ctx.filesModule.files.commands.deleteCounterpartyAttachment({
          fileAssetId: documentId,
          ownerId: counterpartyId,
        });
        return c.json({ deleted: true }, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(upsertCounterpartyContractRoute, async (c) => {
      try {
        const { counterpartyId, customerId } = c.req.valid("param");
        const input = c.req.valid("json");
        await assertCustomerOwnsCounterparty(ctx, {
          counterpartyId,
          customerId,
        });

        const existing = await resolveEffectiveCustomerAgreementByCustomerId(
          ctx,
          customerId,
        );

        if (existing) {
          const updated = await withRequiredIdempotency(c, (idempotencyKey) =>
            updateCustomerAgreement(
              ctx,
              input,
              existing.id,
              c.get("user")!.id,
              idempotencyKey,
            ),
          );

          if (updated instanceof Response) {
            return updated;
          }

          return c.json(updated, 201);
        }

        const created = await withRequiredIdempotency(c, (idempotencyKey) =>
          createCustomerAgreementForCustomer(
            ctx,
            {
              ...input,
              customerId,
            },
            c.get("user")!.id,
            idempotencyKey,
          ),
        );

        if (created instanceof Response) {
          return created;
        }

        return c.json(created, 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    });
}
