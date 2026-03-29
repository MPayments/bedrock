import ExcelJS from "exceljs";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import { CustomerNotFoundError } from "@bedrock/parties";
import {
  ClientDocumentSchema,
  ClientSchema,
  ContractSchema,
  CreateClientInputSchema,
  SubAgentSchema,
} from "@bedrock/operations/contracts";
import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { OpsDeletedSchema, OpsErrorSchema } from "./common";

const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, name: "Calibri", size: 11 },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } },
};

const CustomerWorkspaceLegacyProfileStatusSchema = z.enum(["linked", "missing"]);

const CustomerWorkspaceSummarySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  description: z.string().nullable(),
  directorName: z.string().nullable(),
  displayName: z.string(),
  email: z.string().nullable(),
  externalRef: z.string().nullable(),
  inn: z.string().nullable(),
  legacyClientId: z.number().int().nullable(),
  legacyProfileStatus: CustomerWorkspaceLegacyProfileStatusSchema,
  orgName: z.string(),
  phone: z.string().nullable(),
  updatedAt: z.string(),
});

const LegacyClientProfileSchema = ClientSchema.extend({
  contract: ContractSchema.nullable(),
  contractNumber: z.string().nullable(),
  documents: z.array(ClientDocumentSchema),
  subAgent: SubAgentSchema.nullable(),
});

const CustomerWorkspaceDetailSchema = CustomerWorkspaceSummarySchema.extend({
  account: ClientSchema.shape.account,
  address: ClientSchema.shape.address,
  addressI18n: ClientSchema.shape.addressI18n,
  bankAddress: ClientSchema.shape.bankAddress,
  bankAddressI18n: ClientSchema.shape.bankAddressI18n,
  bankCountry: ClientSchema.shape.bankCountry,
  bankName: ClientSchema.shape.bankName,
  bankNameI18n: ClientSchema.shape.bankNameI18n,
  bic: ClientSchema.shape.bic,
  contractNumber: z.string().nullable(),
  corrAccount: ClientSchema.shape.corrAccount,
  directorBasis: ClientSchema.shape.directorBasis,
  directorBasisI18n: ClientSchema.shape.directorBasisI18n,
  directorNameI18n: ClientSchema.shape.directorNameI18n,
  documents: z.array(ClientDocumentSchema),
  kpp: ClientSchema.shape.kpp,
  legacyProfile: LegacyClientProfileSchema.nullable(),
  ogrn: ClientSchema.shape.ogrn,
  okpo: ClientSchema.shape.okpo,
  oktmo: ClientSchema.shape.oktmo,
  orgNameI18n: ClientSchema.shape.orgNameI18n,
  orgType: ClientSchema.shape.orgType,
  orgTypeI18n: ClientSchema.shape.orgTypeI18n,
  position: ClientSchema.shape.position,
  positionI18n: ClientSchema.shape.positionI18n,
  subAgent: SubAgentSchema.nullable(),
});

const CustomerWorkspaceListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50000).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().trim().optional(),
});

const CustomerWorkspaceParamSchema = z.object({
  id: z.string().uuid().openapi({
    param: {
      in: "path",
      name: "id",
    },
  }),
});

const CustomerWorkspaceUpsertInputSchema = CreateClientInputSchema.extend({
  description: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => normalizeNullableText(value)),
  displayName: z.string().trim().min(1).optional(),
  externalRef: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => normalizeNullableText(value)),
});

const CustomerWorkspacePatchInputSchema = CustomerWorkspaceUpsertInputSchema.partial();

const PaginatedCustomerWorkspacesSchema = createPaginatedListSchema(
  CustomerWorkspaceSummarySchema,
);

type CustomerWorkspaceListQuery = z.infer<typeof CustomerWorkspaceListQuerySchema>;
type CustomerWorkspaceUpsertInput = z.infer<
  typeof CustomerWorkspaceUpsertInputSchema
>;
type CustomerWorkspacePatchInput = z.infer<
  typeof CustomerWorkspacePatchInputSchema
>;
type CustomerWorkspaceSummary = z.infer<typeof CustomerWorkspaceSummarySchema>;

const CUSTOMER_WORKSPACE_EXPORT_COLUMNS = [
  { header: "ID", key: "id" },
  { header: "Организация", key: "displayName" },
  { header: "Внешний код", key: "externalRef" },
  { header: "Описание", key: "description" },
  { header: "ИНН", key: "inn" },
  { header: "Директор", key: "directorName" },
  { header: "Email", key: "email" },
  { header: "Телефон", key: "phone" },
  { header: "Legacy Client ID", key: "legacyClientId" },
  { header: "Статус shell", key: "legacyProfileStatus" },
  { header: "Создан", key: "createdAt" },
] as const;

const LEGACY_CREATE_KEYS = [
  "account",
  "address",
  "addressI18n",
  "agentFee",
  "agentOrganizationBankDetailsId",
  "agentOrganizationId",
  "bankAddress",
  "bankAddressI18n",
  "bankCountry",
  "bankName",
  "bankNameI18n",
  "bic",
  "contractDate",
  "contractNumber",
  "corrAccount",
  "counterpartyId",
  "customerId",
  "directorBasis",
  "directorBasisI18n",
  "directorName",
  "directorNameI18n",
  "email",
  "fixedFee",
  "inn",
  "kpp",
  "ogrn",
  "okpo",
  "oktmo",
  "orgName",
  "orgNameI18n",
  "orgType",
  "orgTypeI18n",
  "phone",
  "position",
  "positionI18n",
  "subAgentId",
] as const satisfies readonly (keyof z.infer<typeof CreateClientInputSchema>)[];

function applyWorksheetDefaults(worksheet: ExcelJS.Worksheet) {
  worksheet.columns.forEach((column) => {
    column.width = 24;
  });

  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.style = HEADER_STYLE;
  });
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function resolveDisplayName(
  input: Pick<CustomerWorkspaceUpsertInput, "displayName" | "orgName">,
  fallback: string,
): string {
  const explicitName = normalizeNullableText(input.displayName);
  if (explicitName) {
    return explicitName;
  }

  const orgName = normalizeNullableText(input.orgName);
  if (orgName) {
    return orgName;
  }

  return fallback;
}

function hasLegacyShellInput(input: CustomerWorkspacePatchInput): boolean {
  return LEGACY_CREATE_KEYS.some((key) => key in input);
}

function extractCanonicalCreateInput(
  input: Pick<
    CustomerWorkspaceUpsertInput,
    "description" | "displayName" | "externalRef" | "orgName"
  >,
  fallbackDisplayName: string,
) {
  return {
    description: normalizeNullableText(input.description),
    displayName: resolveDisplayName(input, fallbackDisplayName),
    externalRef: normalizeNullableText(input.externalRef),
  };
}

function extractCanonicalUpdateInput(
  input: Pick<
    CustomerWorkspacePatchInput,
    "description" | "displayName" | "externalRef" | "orgName"
  >,
  fallbackDisplayName: string,
) {
  const result: {
    description?: string | null;
    displayName?: string;
    externalRef?: string | null;
  } = {};

  if ("description" in input) {
    result.description = normalizeNullableText(input.description);
  }
  if ("externalRef" in input) {
    result.externalRef = normalizeNullableText(input.externalRef);
  }
  if ("displayName" in input || "orgName" in input) {
    result.displayName = resolveDisplayName(
      input as Pick<CustomerWorkspaceUpsertInput, "displayName" | "orgName">,
      fallbackDisplayName,
    );
  }

  return result;
}

function extractLegacyCreateInput(
  input: CustomerWorkspaceUpsertInput,
  customerId: string | null,
  fallbackDisplayName: string,
) {
  return {
    account: input.account,
    address: input.address,
    addressI18n: input.addressI18n,
    agentFee: input.agentFee,
    agentOrganizationBankDetailsId: input.agentOrganizationBankDetailsId,
    agentOrganizationId: input.agentOrganizationId,
    bankAddress: input.bankAddress,
    bankAddressI18n: input.bankAddressI18n,
    bankCountry: input.bankCountry,
    bankName: input.bankName,
    bankNameI18n: input.bankNameI18n,
    bic: input.bic,
    contractDate: input.contractDate,
    contractNumber: input.contractNumber,
    corrAccount: input.corrAccount,
    counterpartyId: input.counterpartyId,
    customerId,
    directorBasis: input.directorBasis,
    directorBasisI18n: input.directorBasisI18n,
    directorName: input.directorName,
    directorNameI18n: input.directorNameI18n,
    email: input.email,
    fixedFee: input.fixedFee,
    inn: input.inn,
    kpp: input.kpp,
    ogrn: input.ogrn,
    okpo: input.okpo,
    oktmo: input.oktmo,
    orgName: resolveDisplayName(input, fallbackDisplayName),
    orgNameI18n: input.orgNameI18n,
    orgType: input.orgType,
    orgTypeI18n: input.orgTypeI18n,
    phone: input.phone,
    position: input.position,
    positionI18n: input.positionI18n,
    subAgentId: input.subAgentId,
  };
}

function extractLegacyUpdateInput(
  input: CustomerWorkspacePatchInput,
  legacyClientId: number,
  customerId: string,
  fallbackDisplayName: string,
) {
  return {
    ...extractLegacyCreateInput(input as CustomerWorkspaceUpsertInput, customerId, fallbackDisplayName),
    id: legacyClientId,
  };
}

async function resolveLinkedCustomerId(ctx: AppContext, input: { id: number; customerId: string | null }) {
  if (input.customerId) {
    return input.customerId;
  }

  const fallback = await ctx.partiesModule.customers.queries.findByExternalRef(
    `ops-client:${input.id}`,
  );
  return fallback?.id ?? null;
}

async function loadLegacyShellMap(ctx: AppContext, customerIds: string[]) {
  const rows =
    await ctx.operationsModule.clients.queries.listActiveByCustomerIds(
      customerIds,
    );

  return new Map(
    rows
      .filter((row) => Boolean(row.customerId))
      .map((row) => [row.customerId!, row] as const),
  );
}

function mapCustomerWorkspaceSummary(input: {
  customer: Awaited<ReturnType<AppContext["partiesModule"]["customers"]["queries"]["findById"]>>;
  legacyClient?: Awaited<
    ReturnType<AppContext["operationsModule"]["clients"]["queries"]["findById"]>
  > | null;
}): CustomerWorkspaceSummary {
  const { customer, legacyClient } = input;

  return {
    createdAt: serializeDate(customer.createdAt),
    description: customer.description,
    directorName: legacyClient?.directorName ?? null,
    displayName: customer.displayName,
    email: legacyClient?.email ?? null,
    externalRef: customer.externalRef,
    id: customer.id,
    inn: legacyClient?.inn ?? null,
    legacyClientId: legacyClient?.id ?? null,
    legacyProfileStatus: legacyClient ? "linked" : "missing",
    orgName: customer.displayName,
    phone: legacyClient?.phone ?? null,
    updatedAt: serializeDate(customer.updatedAt),
  };
}

async function mapCustomerWorkspaceDetail(ctx: AppContext, input: {
  customer: Awaited<ReturnType<AppContext["partiesModule"]["customers"]["queries"]["findById"]>>;
  legacyClient?: Awaited<
    ReturnType<AppContext["operationsModule"]["clients"]["queries"]["findById"]>
  > | null;
}) {
  const summary = mapCustomerWorkspaceSummary(input);
  const legacyClient = input.legacyClient ?? null;
  const documents =
    legacyClient && ctx.operationsModule.clients.documents
      ? await ctx.operationsModule.clients.documents.queries.listByClientId(
          legacyClient.id,
        )
      : [];
  const contract = legacyClient
    ? await ctx.operationsModule.contracts.queries.findByClient(legacyClient.id)
    : null;
  const subAgent =
    legacyClient?.subAgentId != null
      ? await ctx.operationsModule.agents.subAgents.queries.findById(
          legacyClient.subAgentId,
        )
      : null;

  const detail = {
    ...summary,
    account: legacyClient?.account ?? null,
    address: legacyClient?.address ?? null,
    addressI18n: legacyClient?.addressI18n ?? null,
    bankAddress: legacyClient?.bankAddress ?? null,
    bankAddressI18n: legacyClient?.bankAddressI18n ?? null,
    bankCountry: legacyClient?.bankCountry ?? null,
    bankName: legacyClient?.bankName ?? null,
    bankNameI18n: legacyClient?.bankNameI18n ?? null,
    bic: legacyClient?.bic ?? null,
    contractNumber: contract?.contractNumber ?? null,
    corrAccount: legacyClient?.corrAccount ?? null,
    directorBasis: legacyClient?.directorBasis ?? null,
    directorBasisI18n: legacyClient?.directorBasisI18n ?? null,
    directorNameI18n: legacyClient?.directorNameI18n ?? null,
    documents,
    kpp: legacyClient?.kpp ?? null,
    legacyProfile: legacyClient
      ? {
          ...legacyClient,
          contract,
          contractNumber: contract?.contractNumber ?? null,
          documents,
          subAgent,
        }
      : null,
    ogrn: legacyClient?.ogrn ?? null,
    okpo: legacyClient?.okpo ?? null,
    oktmo: legacyClient?.oktmo ?? null,
    orgNameI18n: legacyClient?.orgNameI18n ?? null,
    orgType: legacyClient?.orgType ?? null,
    orgTypeI18n: legacyClient?.orgTypeI18n ?? null,
    position: legacyClient?.position ?? null,
    positionI18n: legacyClient?.positionI18n ?? null,
    subAgent,
  };

  return detail;
}

function matchesWorkspaceSearch(row: CustomerWorkspaceSummary, query: string) {
  const haystack = [
    row.description,
    row.directorName,
    row.displayName,
    row.email,
    row.externalRef,
    row.inn,
    row.phone,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

async function listCustomerWorkspaces(
  ctx: AppContext,
  query: CustomerWorkspaceListQuery,
) {
  if (!query.q) {
    const customers = await ctx.partiesModule.customers.queries.list({
      limit: query.limit,
      offset: query.offset,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    const legacyShellMap = await loadLegacyShellMap(
      ctx,
      customers.data.map((customer) => customer.id),
    );

    return {
      data: customers.data.map((customer) =>
        mapCustomerWorkspaceSummary({
          customer,
          legacyClient: legacyShellMap.get(customer.id) ?? null,
        }),
      ),
      limit: query.limit,
      offset: query.offset,
      total: customers.total,
    };
  }

  const [displayNameMatches, externalRefMatches, legacyMatches] = await Promise.all([
    ctx.partiesModule.customers.queries.list({
      displayName: query.q,
      limit: 1000,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
    ctx.partiesModule.customers.queries.list({
      externalRef: query.q,
      limit: 1000,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
    ctx.operationsModule.clients.queries.list({
      isDeleted: false,
      limit: 1000,
      offset: 0,
      search: query.q,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
  ]);

  const customerMap = new Map<string, (typeof displayNameMatches.data)[number]>();
  for (const customer of [...displayNameMatches.data, ...externalRefMatches.data]) {
    customerMap.set(customer.id, customer);
  }

  const legacyCustomerIds = legacyMatches.data
    .map((client) => client.customerId)
    .filter((customerId): customerId is string => Boolean(customerId));
  if (legacyCustomerIds.length > 0) {
    const customers =
      await ctx.partiesModule.customers.queries.listByIds(legacyCustomerIds);
    for (const customer of customers) {
      customerMap.set(customer.id, customer);
    }
  }

  const customers = [...customerMap.values()].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  const legacyShellMap = await loadLegacyShellMap(
    ctx,
    customers.map((customer) => customer.id),
  );
  const filtered = customers
    .map((customer) =>
      mapCustomerWorkspaceSummary({
        customer,
        legacyClient: legacyShellMap.get(customer.id) ?? null,
      }),
    )
    .filter((row) => matchesWorkspaceSearch(row, query.q!));

  return {
    data: filtered.slice(query.offset, query.offset + query.limit),
    limit: query.limit,
    offset: query.offset,
    total: filtered.length,
  };
}

async function getCustomerWorkspace(ctx: AppContext, customerId: string) {
  const customer = await ctx.partiesModule.customers.queries.findById(customerId);
  const legacyClient =
    await ctx.operationsModule.clients.queries.findActiveByCustomerId(customerId);

  return mapCustomerWorkspaceDetail(ctx, {
    customer,
    legacyClient,
  });
}

async function exportCustomerWorkspacesXlsx(ctx: AppContext) {
  const result = await listCustomerWorkspaces(ctx, {
    limit: 50000,
    offset: 0,
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Клиенты");

  worksheet.columns = CUSTOMER_WORKSPACE_EXPORT_COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
  }));

  for (const row of result.data) {
    worksheet.addRow(row);
  }

  applyWorksheetDefaults(worksheet);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}

function xlsxFilename(prefix: string) {
  return `${prefix}-${formatDate(new Date())}.xlsx`;
}

export function operationsCustomersRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    method: "get",
    path: "/",
    request: { query: CustomerWorkspaceListQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": { schema: PaginatedCustomerWorkspacesSchema },
        },
        description: "Customer-rooted workspace list",
      },
    },
    summary: "List customer workspaces",
    tags: ["Operations - Customers"],
  });

  const exportRoute = createRoute({
    method: "get",
    path: "/export/xlsx",
    responses: { 200: { description: "Customer workspace XLSX file" } },
    summary: "Export customer workspaces to XLSX",
    tags: ["Operations - Customers"],
  });

  const getRoute = createRoute({
    method: "get",
    path: "/{id}",
    request: { params: CustomerWorkspaceParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: CustomerWorkspaceDetailSchema } },
        description: "Customer workspace detail",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Customer not found",
      },
    },
    summary: "Get a customer workspace by canonical customer ID",
    tags: ["Operations - Customers"],
  });

  const createRoute_ = createRoute({
    method: "post",
    path: "/",
    request: {
      body: {
        content: {
          "application/json": { schema: CustomerWorkspaceUpsertInputSchema },
        },
        required: true,
      },
    },
    responses: {
      201: {
        content: { "application/json": { schema: CustomerWorkspaceDetailSchema } },
        description: "Customer workspace created",
      },
    },
    summary: "Create a canonical customer and linked legacy shell",
    tags: ["Operations - Customers"],
  });

  const updateRoute = createRoute({
    method: "patch",
    path: "/{id}",
    request: {
      body: {
        content: {
          "application/json": { schema: CustomerWorkspacePatchInputSchema },
        },
        required: true,
      },
      params: CustomerWorkspaceParamSchema,
    },
    responses: {
      200: {
        content: { "application/json": { schema: CustomerWorkspaceDetailSchema } },
        description: "Customer workspace updated",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Customer not found",
      },
    },
    summary: "Update canonical customer identity and upsert legacy shell",
    tags: ["Operations - Customers"],
  });

  const deleteRoute = createRoute({
    method: "delete",
    path: "/{id}",
    request: { params: CustomerWorkspaceParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: OpsDeletedSchema } },
        description: "Legacy shell archived",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Customer not found",
      },
    },
    summary: "Archive the linked legacy shell for a canonical customer",
    tags: ["Operations - Customers"],
  });

  return app
    .openapi(exportRoute, async () => {
      const buffer = await exportCustomerWorkspacesXlsx(ctx);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Disposition": `attachment; filename="${xlsxFilename("customers")}"`,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        status: 200,
      });
    })
    .openapi(listRoute, async (c) => {
      const query = c.req.valid("query");
      const result = await listCustomerWorkspaces(ctx, query);
      return c.json(result, 200);
    })
    .openapi(getRoute, async (c) => {
      const { id } = c.req.valid("param");

      try {
        const result = await getCustomerWorkspace(ctx, id);
        return c.json(result, 200);
      } catch (error) {
        if (error instanceof CustomerNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    })
    .openapi(createRoute_, async (c) => {
      const input = c.req.valid("json");
      const canonical = extractCanonicalCreateInput(input, input.orgName);
      const createdClient = await ctx.operationsModule.clients.commands.create(
        extractLegacyCreateInput(input, null, canonical.displayName),
      );
      const customerId = await resolveLinkedCustomerId(ctx, createdClient);

      if (!customerId) {
        throw new Error(
          `Could not resolve canonical customer for legacy client ${createdClient.id}`,
        );
      }

      await ctx.partiesModule.customers.commands.update(customerId, canonical);
      const result = await getCustomerWorkspace(ctx, customerId);
      return c.json(result, 201);
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
        const input = c.req.valid("json");

      try {
        const currentCustomer = await ctx.partiesModule.customers.queries.findById(id);
        const canonical = extractCanonicalUpdateInput(
          input,
          currentCustomer.displayName,
        );
        const legacyDisplayName = canonical.displayName ?? currentCustomer.displayName;
        const legacyClient =
          await ctx.operationsModule.clients.queries.findActiveByCustomerId(id);

        if (legacyClient) {
          await ctx.operationsModule.clients.commands.update(
            extractLegacyUpdateInput(input, legacyClient.id, id, legacyDisplayName),
          );
        } else if (hasLegacyShellInput(input)) {
          await ctx.operationsModule.clients.commands.create(
            extractLegacyCreateInput(
              input as CustomerWorkspaceUpsertInput,
              id,
              legacyDisplayName,
            ),
          );
        }

        await ctx.partiesModule.customers.commands.update(id, canonical);

        const result = await getCustomerWorkspace(ctx, id);
        return c.json(result, 200);
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
        await ctx.partiesModule.customers.queries.findById(id);
        const legacyClient =
          await ctx.operationsModule.clients.queries.findActiveByCustomerId(id);
        if (legacyClient) {
          await ctx.operationsModule.clients.commands.softDelete(legacyClient.id);
        }

        return c.json({ deleted: true }, 200);
      } catch (error) {
        if (error instanceof CustomerNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    });
}
