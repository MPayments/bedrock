import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { IdParamSchema } from "../../common";
import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permission";
import { OpsErrorSchema, OpsIdParamSchema } from "./common";
import { findCompatibilityCalculationById } from "./calculations-compat";
import { resolveEffectiveCompatibilityContractByClientId } from "./contracts-compat";
import {
  getOrganizationBankRequisiteOrThrow,
  serializeOrganizationRequisiteForDocuments,
} from "../organization-requisites";

const FIELD_METADATA: Record<string, { label: string; category: string }> = {
  date: { label: "Дата", category: "Документ" },
  createdAt: { label: "Дата создания", category: "Документ" },
  applicationNumber: { label: "Номер заявки", category: "Документ" },
  invoiceNumber: { label: "Номер счёта", category: "Документ" },
  acceptanceNumber: { label: "Номер акта", category: "Документ" },
  calculationNumber: { label: "Номер расчёта", category: "Документ" },
  calculationDate: { label: "Дата расчёта", category: "Документ" },
  orgName: { label: "Название организации", category: "Клиент" },
  orgType: { label: "Тип организации", category: "Клиент" },
  directorName: { label: "ФИО директора", category: "Клиент" },
  directorInitials: { label: "Инициалы директора", category: "Клиент" },
  directorBasis: { label: "Основание действий директора", category: "Клиент" },
  inn: { label: "ИНН", category: "Клиент" },
  kpp: { label: "КПП", category: "Клиент" },
  ogrn: { label: "ОГРН", category: "Клиент" },
  account: { label: "Расчётный счёт", category: "Клиент" },
  corrAccount: { label: "Корр. счёт", category: "Клиент" },
  bic: { label: "БИК", category: "Клиент" },
  address: { label: "Адрес", category: "Клиент" },
  bankName: { label: "Название банка", category: "Клиент" },
  agentName: { label: "Название организации агента", category: "Агент" },
  agentAddress: { label: "Адрес агента", category: "Агент" },
  agentDirectorName: {
    label: "ФИО директора агента",
    category: "Агент",
  },
  agentTaxId: { label: "Tax ID агента", category: "Агент" },
  agentBankAccount: { label: "Счёт банка агента", category: "Агент" },
  agentBankBic: { label: "БИК банка агента", category: "Агент" },
  agentBankSwiftCode: { label: "SWIFT банка агента", category: "Агент" },
  contractNumber: { label: "Номер договора", category: "Договор" },
  contractDate: { label: "Дата договора", category: "Договор" },
  agentFee: { label: "Комиссия агента (%)", category: "Договор" },
  fixedFee: { label: "Фикс. комиссия", category: "Договор" },
  companyName: { label: "Компания-получатель", category: "Сделка" },
  dealContractNumber: { label: "Номер контракта сделки", category: "Сделка" },
  dealInvoiceNumber: { label: "Номер инвойса", category: "Сделка" },
  swiftCode: { label: "SWIFT-код получателя", category: "Сделка" },
  currencyCode: { label: "Валюта перевода", category: "Расчёт" },
  originalAmount: { label: "Сумма в валюте", category: "Расчёт" },
  totalAmount: { label: "Итого с комиссией", category: "Расчёт" },
  baseCurrencyCode: { label: "Базовая валюта", category: "Расчёт" },
  rate: { label: "Курс", category: "Расчёт" },
  feeAmountInBase: { label: "Комиссия (в базовой валюте)", category: "Расчёт" },
  totalWithExpensesInBase: {
    label: "Итого с расходами (в базовой валюте)",
    category: "Расчёт",
  },
};

export function operationsDocumentsRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  // Export calculation as DOCX/PDF
  const exportCalculationRoute = createRoute({
    middleware: [requirePermission({ calculations: ["list"] })],
    method: "get",
    path: "/calculations/{id}/export",
    tags: ["Operations - Documents"],
    summary: "Export calculation as DOCX/PDF",
    request: {
      params: IdParamSchema,
      query: z.object({
        format: z.enum(["docx", "pdf"]).default("pdf"),
        lang: z.enum(["ru", "en"]).default("ru"),
      }),
    },
    responses: {
      200: { description: "Document file" },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Calculation not found",
      },
    },
  });

  // Generate client contract
  const generateContractRoute = createRoute({
    method: "get",
    path: "/clients/{id}/contract",
    tags: ["Operations - Documents"],
    summary: "Generate client contract document",
    request: {
      params: OpsIdParamSchema,
      query: z.object({
        format: z.enum(["docx", "pdf"]).default("docx"),
        lang: z.enum(["ru", "en"]).default("ru"),
      }),
    },
    responses: {
      200: { description: "Document file" },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Client or contract not found",
      },
    },
  });

  // List templates
  const listTemplatesRoute = createRoute({
    method: "get",
    path: "/templates",
    tags: ["Operations - Documents"],
    summary: "List available document templates",
    request: {
      query: z.object({
        organizationId: z.string().uuid().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(
              z.object({ name: z.string(), label: z.string().nullable() }),
            ),
          },
        },
        description: "Template list",
      },
    },
  });

  // Get template fields
  const getTemplateFieldsRoute = createRoute({
    method: "get",
    path: "/templates/{name}/fields",
    tags: ["Operations - Documents"],
    summary: "Get placeholder fields for a template",
    request: {
      params: z.object({ name: z.string() }),
      query: z.object({
        organizationId: z.string().uuid().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(
              z.object({
                name: z.string(),
                label: z.string(),
                category: z.string(),
              }),
            ),
          },
        },
        description: "Template fields",
      },
    },
  });

  // Generate from raw data
  const generateFromRawRoute = createRoute({
    method: "post",
    path: "/generate",
    tags: ["Operations - Documents"],
    summary: "Generate document from raw data",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              templateName: z.string().min(1),
              data: z.record(z.string(), z.string()),
              format: z.enum(["docx", "pdf"]).default("docx"),
              organizationId: z.string().uuid().optional(),
            }),
          },
        },
        required: true,
      },
    },
    responses: {
      200: { description: "Document file" },
    },
  });

  const TEMPLATE_LABELS: Record<string, string> = {
    "contract.docx": "Агентский договор",
    "application.docx": "Заявка на перевод",
    "invoice.docx": "Счёт на оплату",
    "acceptance.docx": "Акт оказанных услуг",
    "calculation.docx": "Расчёт",
  };

  return app
    .openapi(exportCalculationRoute, async (c) => {
      const { id } = c.req.valid("param");
      const { format, lang } = c.req.valid("query");

      const calculation = await findCompatibilityCalculationById(id);
      if (!calculation) return c.json({ error: "Calculation not found" }, 404);

      const result =
        await ctx.documentGenerationWorkflow.generateCalculation({
          calculationData: calculation as unknown as Record<string, unknown>,
          format,
          lang,
        });

      c.header("Content-Type", result.mimeType);
      c.header(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );
      return c.body(result.buffer as unknown as ArrayBuffer);
    })
    .openapi(generateContractRoute, async (c) => {
      const { id } = c.req.valid("param");
      const { format, lang } = c.req.valid("query");

      const client = await ctx.operationsModule.clients.queries.findById(id);
      if (!client) return c.json({ error: "Client not found" }, 404);

      const contract = await resolveEffectiveCompatibilityContractByClientId(
        ctx,
        id,
      );
      if (!contract) return c.json({ error: "Contract not found" }, 404);
      const organization = await ctx.partiesModule.organizations.queries.findById(
        contract.organizationId,
      );
      const organizationRequisite = await getOrganizationBankRequisiteOrThrow(
        ctx,
        contract.organizationRequisiteId,
      );
      if (!organization || !organizationRequisite) {
        return c.json({ error: "Organization not found" }, 404);
      }

      const result =
        await ctx.documentGenerationWorkflow.generateClientContract({
          client: client as unknown as Record<string, unknown>,
          contract: contract as unknown as Record<string, unknown>,
          organization: (organization ?? {}) as Record<string, unknown>,
          organizationRequisite: await serializeOrganizationRequisiteForDocuments(
            ctx,
            organizationRequisite,
          ),
          format,
          lang,
        });

      c.header("Content-Type", result.mimeType);
      c.header(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );
      return c.body(result.buffer as unknown as ArrayBuffer);
    })
    .openapi(listTemplatesRoute, async (c) => {
      const { organizationId } = c.req.valid("query");
      const templates =
        await ctx.documentGenerationWorkflow.listTemplates(organizationId);
      const result = templates.map((name) => ({
        name,
        label: TEMPLATE_LABELS[name] ?? null,
      }));
      return c.json(result, 200);
    })
    .openapi(getTemplateFieldsRoute, async (c) => {
      const { name } = c.req.valid("param");
      const { organizationId } = c.req.valid("query");
      const fields = await ctx.documentGenerationWorkflow.getTemplateFields(
        name,
        organizationId,
      );
      const result = fields.map((fieldName) => {
        const meta = FIELD_METADATA[fieldName];
        return {
          name: fieldName,
          label: meta?.label ?? fieldName,
          category: meta?.category ?? "Другое",
        };
      });
      return c.json(result, 200);
    })
    .openapi(generateFromRawRoute, async (c) => {
      const input = c.req.valid("json");
      const result =
        await ctx.documentGenerationWorkflow.generateFromRawData(input);

      c.header("Content-Type", result.mimeType);
      c.header(
        "Content-Disposition",
        `attachment; filename="${result.fileName}"`,
      );
      return c.body(result.buffer as unknown as ArrayBuffer);
    });
}
