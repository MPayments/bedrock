import ExcelJS from "exceljs";
import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";

import {
  CustomerNotFoundError,
  OrganizationNotFoundError,
} from "@bedrock/parties";
import {
  SubAgentProfileSchema,
} from "@bedrock/parties/contracts";
import {
  ClientDocumentSchema as OperationsClientDocumentSchema,
  ClientSchema,
  ContractSchema,
  CreateClientInputSchema,
} from "@bedrock/operations/contracts";
import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

import type { AppContext } from "../../context";
import type { AuthVariables } from "../../middleware/auth";
import { OpsDeletedSchema, OpsErrorSchema } from "./common";
import {
  findCanonicalOrganizationByLegacyId,
  resolveLegacyHoldingOrganizationByCanonicalId,
} from "../organization-bridge";
import {
  getOrganizationBankRequisiteOrThrow,
  serializeOrganizationRequisiteForDocuments,
} from "../organization-requisites";

const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, name: "Calibri", size: 11 },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } },
};

const CustomerWorkspaceSummarySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  description: z.string().nullable(),
  directorName: z.string().nullable(),
  displayName: z.string(),
  email: z.string().nullable(),
  externalRef: z.string().nullable(),
  inn: z.string().nullable(),
  legalEntityCount: z.number().int(),
  phone: z.string().nullable(),
  primaryCounterpartyId: z.string().uuid().nullable(),
  updatedAt: z.string(),
});

const CustomerLegalEntitySchema = z.object({
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
  counterpartyId: z.string().uuid(),
  country: z.string().nullable(),
  createdAt: z.string(),
  directorBasis: ClientSchema.shape.directorBasis,
  directorBasisI18n: ClientSchema.shape.directorBasisI18n,
  directorName: ClientSchema.shape.directorName,
  directorNameI18n: ClientSchema.shape.directorNameI18n,
  email: ClientSchema.shape.email,
  externalId: z.string().nullable(),
  fullName: z.string(),
  hasLegacyShell: z.boolean(),
  inn: ClientSchema.shape.inn,
  kpp: ClientSchema.shape.kpp,
  ogrn: ClientSchema.shape.ogrn,
  okpo: ClientSchema.shape.okpo,
  oktmo: ClientSchema.shape.oktmo,
  orgName: ClientSchema.shape.orgName,
  orgNameI18n: ClientSchema.shape.orgNameI18n,
  orgType: ClientSchema.shape.orgType,
  orgTypeI18n: ClientSchema.shape.orgTypeI18n,
  phone: ClientSchema.shape.phone,
  position: ClientSchema.shape.position,
  positionI18n: ClientSchema.shape.positionI18n,
  relationshipKind: z.enum(["customer_owned", "external"]),
  shortName: z.string(),
  subAgent: SubAgentProfileSchema.nullable(),
  subAgentCounterpartyId: z.string().uuid().nullable(),
  updatedAt: z.string(),
});

const CustomerLegalEntityDocumentSchema = OperationsClientDocumentSchema.omit({
  clientId: true,
});

const CustomerLegalEntityContractSchema = ContractSchema.omit({
  agentOrganizationId: true,
  clientId: true,
}).extend({
  organizationId: z.string().uuid().nullable(),
});

const CustomerWorkspaceDetailSchema = z.object({
  createdAt: z.string(),
  description: z.string().nullable(),
  displayName: z.string(),
  externalRef: z.string().nullable(),
  id: z.string().uuid(),
  legalEntities: z.array(CustomerLegalEntitySchema),
  legalEntityCount: z.number().int(),
  primaryCounterpartyId: z.string().uuid().nullable(),
  updatedAt: z.string(),
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

const CustomerLegalEntityParamsSchema = z.object({
  counterpartyId: z.string().uuid().openapi({
    param: {
      in: "path",
      name: "counterpartyId",
    },
  }),
  customerId: z.string().uuid().openapi({
    param: {
      in: "path",
      name: "customerId",
    },
  }),
});

const CustomerLegalEntityDocumentParamsSchema = CustomerLegalEntityParamsSchema.extend({
  documentId: z.coerce.number().int().openapi({
    param: {
      in: "path",
      name: "documentId",
    },
  }),
});

const CustomerLegalEntityInputSchema = CreateClientInputSchema.extend({
  country: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => normalizeNullableText(value)),
});

const CustomerLegalEntityPatchInputSchema =
  CustomerLegalEntityInputSchema.partial();

const CustomerWorkspaceUpsertInputSchema = CustomerLegalEntityInputSchema.extend({
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

const CustomerWorkspacePatchInputSchema = z.object({
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
type CustomerLegalEntityInput = z.infer<typeof CustomerLegalEntityInputSchema>;
type CustomerLegalEntityPatchInput = z.infer<
  typeof CustomerLegalEntityPatchInputSchema
>;
type CustomerWorkspaceSummary = z.infer<typeof CustomerWorkspaceSummarySchema>;
type CanonicalCustomer = Awaited<
  ReturnType<AppContext["partiesModule"]["customers"]["queries"]["findById"]>
>;
type CanonicalCounterparty = Awaited<
  ReturnType<AppContext["partiesModule"]["counterparties"]["queries"]["findById"]>
>;
type CanonicalCounterpartyListItem = Awaited<
  ReturnType<AppContext["partiesModule"]["counterparties"]["queries"]["list"]>
>["data"][number];
type LegacyClient = Awaited<
  ReturnType<AppContext["operationsModule"]["clients"]["queries"]["findById"]>
>;

const CUSTOMER_WORKSPACE_EXPORT_COLUMNS = [
  { header: "ID", key: "id" },
  { header: "Организация", key: "displayName" },
  { header: "Внешний код", key: "externalRef" },
  { header: "Описание", key: "description" },
  { header: "ИНН", key: "inn" },
  { header: "Директор", key: "directorName" },
  { header: "Email", key: "email" },
  { header: "Телефон", key: "phone" },
  { header: "Юр. лиц", key: "legalEntityCount" },
  { header: "Primary Counterparty", key: "primaryCounterpartyId" },
  { header: "Создан", key: "createdAt" },
] as const;

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

function normalizeCountryCode(value: string | null | undefined): string | null {
  const normalized = normalizeNullableText(value)?.toUpperCase() ?? null;
  return normalized && normalized.length === 2 ? normalized : null;
}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function resolveDisplayName(
  input: Pick<CustomerWorkspaceUpsertInput, "displayName" | "orgName">,
  fallback: string,
) {
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

function buildCounterpartyPayload(input: {
  customerId: string;
  values: Pick<
    CustomerLegalEntityInput,
    "bankCountry" | "country" | "inn" | "orgName"
  >;
}) {
  return {
    country: normalizeCountryCode(input.values.country ?? input.values.bankCountry),
    customerId: input.customerId,
    externalId: normalizeNullableText(input.values.inn),
    fullName: input.values.orgName,
    kind: "legal_entity" as const,
    relationshipKind: "customer_owned" as const,
    shortName: input.values.orgName,
  };
}

function buildLegacyShellCreateInput(input: {
  customerId: string;
  counterpartyId: string;
  values: CustomerLegalEntityInput;
}) {
  const { country: _country, ...shellValues } = input.values;
  return {
    ...shellValues,
    counterpartyId: input.counterpartyId,
    customerId: input.customerId,
  };
}

function buildLegacyShellUpdateInput(input: {
  clientId: number;
  customerId: string;
  counterpartyId: string;
  values: CustomerLegalEntityInput;
}) {
  const { country: _country, ...shellValues } = input.values;
  return {
    ...shellValues,
    counterpartyId: input.counterpartyId,
    customerId: input.customerId,
    id: input.clientId,
  };
}

async function listCustomerOwnedCounterpartiesByCustomerId(
  ctx: AppContext,
  customerIds: string[],
) {
  const uniqueCustomerIds = Array.from(new Set(customerIds));
  const rows = await Promise.all(
    uniqueCustomerIds.map(async (customerId) => {
      const result = await ctx.partiesModule.counterparties.queries.list({
        customerId,
        relationshipKind: ["customer_owned"],
        limit: 200,
        offset: 0,
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      return [customerId, result.data] as const;
    }),
  );

  return new Map<string, CanonicalCounterpartyListItem[]>(rows);
}

async function listActiveShellsByCounterpartyId(
  ctx: AppContext,
  counterpartyIds: string[],
) {
  const rows =
    await ctx.operationsModule.clients.queries.listActiveByCounterpartyIds(
      counterpartyIds,
    );

  return new Map(
    rows
      .filter((row) => Boolean(row.counterpartyId))
      .map((row) => [row.counterpartyId!, row] as const),
  );
}

async function mapCustomerLegalEntity(
  ctx: AppContext,
  counterparty: CanonicalCounterpartyListItem,
  shell?: LegacyClient | null,
) {
  const legacyShell = shell ?? null;
  const [contract, subAgent] = await Promise.all([
    legacyShell
      ? ctx.operationsModule.contracts.queries.findByClient(legacyShell.id)
      : Promise.resolve(null),
    legacyShell?.subAgentCounterpartyId
      ? ctx.partiesModule.subAgentProfiles.queries.findById(
          legacyShell.subAgentCounterpartyId,
        )
      : Promise.resolve(null),
  ]);

  return {
    account: legacyShell?.account ?? null,
    address: legacyShell?.address ?? null,
    addressI18n: legacyShell?.addressI18n ?? null,
    bankAddress: legacyShell?.bankAddress ?? null,
    bankAddressI18n: legacyShell?.bankAddressI18n ?? null,
    bankCountry: legacyShell?.bankCountry ?? null,
    bankName: legacyShell?.bankName ?? null,
    bankNameI18n: legacyShell?.bankNameI18n ?? null,
    bic: legacyShell?.bic ?? null,
    contractNumber: contract?.contractNumber ?? null,
    corrAccount: legacyShell?.corrAccount ?? null,
    counterpartyId: counterparty.id,
    country: counterparty.country ?? null,
    createdAt: serializeDate(counterparty.createdAt),
    directorBasis: legacyShell?.directorBasis ?? null,
    directorBasisI18n: legacyShell?.directorBasisI18n ?? null,
    directorName: legacyShell?.directorName ?? null,
    directorNameI18n: legacyShell?.directorNameI18n ?? null,
    email: legacyShell?.email ?? null,
    externalId: counterparty.externalId,
    fullName: counterparty.fullName,
    hasLegacyShell: Boolean(legacyShell),
    inn: legacyShell?.inn ?? counterparty.externalId ?? null,
    kpp: legacyShell?.kpp ?? null,
    ogrn: legacyShell?.ogrn ?? null,
    okpo: legacyShell?.okpo ?? null,
    oktmo: legacyShell?.oktmo ?? null,
    orgName: legacyShell?.orgName ?? counterparty.shortName,
    orgNameI18n: legacyShell?.orgNameI18n ?? null,
    orgType: legacyShell?.orgType ?? null,
    orgTypeI18n: legacyShell?.orgTypeI18n ?? null,
    phone: legacyShell?.phone ?? null,
    position: legacyShell?.position ?? null,
    positionI18n: legacyShell?.positionI18n ?? null,
    relationshipKind: counterparty.relationshipKind,
    shortName: counterparty.shortName,
    subAgent,
    subAgentCounterpartyId: legacyShell?.subAgentCounterpartyId ?? null,
    updatedAt: serializeDate(counterparty.updatedAt),
  };
}

async function mapCustomerWorkspaceSummary(
  ctx: AppContext,
  customer: CanonicalCustomer,
  counterparties: CanonicalCounterpartyListItem[],
  shellMap: Map<string, LegacyClient>,
): Promise<CustomerWorkspaceSummary> {
  const primaryCounterparty = counterparties[0] ?? null;
  const primaryShell = primaryCounterparty
    ? shellMap.get(primaryCounterparty.id) ?? null
    : null;

  return {
    createdAt: serializeDate(customer.createdAt),
    description: customer.description,
    directorName: primaryShell?.directorName ?? null,
    displayName: customer.displayName,
    email: primaryShell?.email ?? null,
    externalRef: customer.externalRef,
    id: customer.id,
    inn: primaryShell?.inn ?? primaryCounterparty?.externalId ?? null,
    legalEntityCount: counterparties.length,
    phone: primaryShell?.phone ?? null,
    primaryCounterpartyId: primaryCounterparty?.id ?? null,
    updatedAt: serializeDate(customer.updatedAt),
  };
}

async function mapCustomerWorkspaceDetail(
  ctx: AppContext,
  customer: CanonicalCustomer,
  counterparties: CanonicalCounterpartyListItem[],
  shellMap: Map<string, LegacyClient>,
) {
  const legalEntities = await Promise.all(
    counterparties.map((counterparty) =>
      mapCustomerLegalEntity(ctx, counterparty, shellMap.get(counterparty.id) ?? null),
    ),
  );

  return {
    createdAt: serializeDate(customer.createdAt),
    description: customer.description,
    displayName: customer.displayName,
    externalRef: customer.externalRef,
    id: customer.id,
    legalEntities,
    legalEntityCount: legalEntities.length,
    primaryCounterpartyId: legalEntities[0]?.counterpartyId ?? null,
    updatedAt: serializeDate(customer.updatedAt),
  };
}

function stripClientIdFromDocument(
  document: z.infer<typeof OperationsClientDocumentSchema>,
) {
  const { clientId: _clientId, ...rest } = document;
  return rest;
}

async function serializeContractForPublic(
  ctx: AppContext,
  contract: z.infer<typeof ContractSchema>,
) {
  const { agentOrganizationId: _agentOrganizationId, clientId: _clientId, ...rest } =
    contract;
  const organization = contract.agentOrganizationId
    ? await findCanonicalOrganizationByLegacyId(
        ctx,
        contract.agentOrganizationId,
      )
    : null;

  return {
    ...rest,
    organizationId: organization?.id ?? null,
  };
}

async function getCustomerOrThrow(ctx: AppContext, customerId: string) {
  return ctx.partiesModule.customers.queries.findById(customerId);
}

async function getCustomerOwnedCounterparties(
  ctx: AppContext,
  customerId: string,
) {
  const result = await ctx.partiesModule.counterparties.queries.list({
    customerId,
    relationshipKind: ["customer_owned"],
    limit: 200,
    offset: 0,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  return result.data;
}

async function ensureCustomerOwnedCounterparty(
  ctx: AppContext,
  input: { counterpartyId: string; customerId: string },
) {
  const counterparty = await ctx.partiesModule.counterparties.queries.findById(
    input.counterpartyId,
  );
  if (
    !counterparty ||
    counterparty.customerId !== input.customerId ||
    counterparty.relationshipKind !== "customer_owned"
  ) {
    throw new Error(
      `Counterparty ${input.counterpartyId} is not linked to customer ${input.customerId}`,
    );
  }

  return counterparty;
}

async function ensureActiveShellForCounterparty(
  ctx: AppContext,
  input: { counterpartyId: string; customerId: string },
) {
  const existing =
    await ctx.operationsModule.clients.queries.findActiveByCounterpartyId(
      input.counterpartyId,
    );
  if (existing) {
    return existing;
  }

  const counterparty = await ensureCustomerOwnedCounterparty(ctx, input);

  return ctx.operationsModule.clients.commands.create(
    buildLegacyShellCreateInput({
      counterpartyId: counterparty.id,
      customerId: input.customerId,
        values: {
        account: null,
        address: null,
        addressI18n: null,
        agentFee: null,
        agentOrganizationId: null,
        bankAddress: null,
        bankAddressI18n: null,
        bankCountry: counterparty.country ?? null,
        bankName: null,
        bankNameI18n: null,
        bic: null,
        contractDate: null,
        contractId: null,
        contractNumber: null,
        corrAccount: null,
        counterpartyId: counterparty.id,
        country: counterparty.country ?? null,
        customerId: input.customerId,
        directorBasis: null,
        directorBasisI18n: null,
        directorName: null,
        directorNameI18n: null,
        email: null,
        fixedFee: null,
        inn: counterparty.externalId ?? null,
        kpp: null,
        organizationRequisiteId: null,
        ogrn: null,
        okpo: null,
        oktmo: null,
        orgName: counterparty.shortName,
        orgNameI18n: null,
        orgType: null,
        orgTypeI18n: null,
        phone: null,
        position: null,
        positionI18n: null,
        subAgentCounterpartyId: null,
      },
    }),
  );
}

async function upsertLegalEntity(
  ctx: AppContext,
  input: {
    counterpartyId?: string;
    customerId: string;
    values: CustomerLegalEntityInput;
  },
) {
  let counterpartyId = input.counterpartyId ?? null;

  if (counterpartyId) {
    await ensureCustomerOwnedCounterparty(ctx, {
      counterpartyId,
      customerId: input.customerId,
    });
    await ctx.partiesModule.counterparties.commands.update(
      counterpartyId,
      buildCounterpartyPayload({
        customerId: input.customerId,
        values: input.values,
      }),
    );
  } else {
    const createdCounterparty =
      await ctx.partiesModule.counterparties.commands.create(
        buildCounterpartyPayload({
          customerId: input.customerId,
          values: input.values,
        }),
      );
    counterpartyId = createdCounterparty.id;
  }

  const existingShell =
    await ctx.operationsModule.clients.queries.findActiveByCounterpartyId(
      counterpartyId,
    );
  if (existingShell) {
    await ctx.operationsModule.clients.commands.update(
      buildLegacyShellUpdateInput({
        clientId: existingShell.id,
        counterpartyId,
        customerId: input.customerId,
        values: input.values,
      }),
    );
  } else {
    await ctx.operationsModule.clients.commands.create(
      buildLegacyShellCreateInput({
        counterpartyId,
        customerId: input.customerId,
        values: input.values,
      }),
    );
  }

  const counterparty = await ensureCustomerOwnedCounterparty(ctx, {
    counterpartyId,
    customerId: input.customerId,
  });
  const shell =
    await ctx.operationsModule.clients.queries.findActiveByCounterpartyId(
      counterpartyId,
    );

  return mapCustomerLegalEntity(ctx, counterparty, shell);
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
    const counterpartiesByCustomerId =
      await listCustomerOwnedCounterpartiesByCustomerId(
        ctx,
        customers.data.map((customer) => customer.id),
      );
    const shellMap = await listActiveShellsByCounterpartyId(
      ctx,
      [...counterpartiesByCustomerId.values()].flat().map(
        (counterparty) => counterparty.id,
      ),
    );

    return {
      data: await Promise.all(
        customers.data.map((customer) =>
          mapCustomerWorkspaceSummary(
            ctx,
            customer,
            counterpartiesByCustomerId.get(customer.id) ?? [],
            shellMap,
          ),
        ),
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

  const customerMap = new Map<string, CanonicalCustomer>();
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
  const counterpartiesByCustomerId =
    await listCustomerOwnedCounterpartiesByCustomerId(
      ctx,
      customers.map((customer) => customer.id),
    );
  const shellMap = await listActiveShellsByCounterpartyId(
    ctx,
    [...counterpartiesByCustomerId.values()].flat().map(
      (counterparty) => counterparty.id,
    ),
  );
  const rows = await Promise.all(
    customers.map((customer) =>
      mapCustomerWorkspaceSummary(
        ctx,
        customer,
        counterpartiesByCustomerId.get(customer.id) ?? [],
        shellMap,
      ),
    ),
  );
  return {
    data: rows.slice(query.offset, query.offset + query.limit),
    limit: query.limit,
    offset: query.offset,
    total: rows.length,
  };
}

async function getCustomerWorkspace(ctx: AppContext, customerId: string) {
  const customer = await getCustomerOrThrow(ctx, customerId);
  const counterparties = await getCustomerOwnedCounterparties(ctx, customerId);
  const shellMap = await listActiveShellsByCounterpartyId(
    ctx,
    counterparties.map((counterparty) => counterparty.id),
  );

  return mapCustomerWorkspaceDetail(ctx, customer, counterparties, shellMap);
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

async function resolveLegacyShellForLegalEntity(
  ctx: AppContext,
  input: { counterpartyId: string; customerId: string },
) {
  return ensureActiveShellForCounterparty(ctx, input);
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
    summary: "Create a canonical customer and initial legal entity",
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
    summary: "Update canonical customer identity",
    tags: ["Operations - Customers"],
  });

  const deleteRoute = createRoute({
    method: "delete",
    path: "/{id}",
    request: { params: CustomerWorkspaceParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: OpsDeletedSchema } },
        description: "Linked legacy shells archived",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Customer not found",
      },
    },
    summary: "Archive all linked legacy shells for a canonical customer",
    tags: ["Operations - Customers"],
  });

  const listLegalEntitiesRoute = createRoute({
    method: "get",
    path: "/{customerId}/legal-entities",
    request: { params: CustomerLegalEntityParamsSchema.omit({ counterpartyId: true }) },
    responses: {
      200: {
        content: { "application/json": { schema: z.array(CustomerLegalEntitySchema) } },
        description: "Customer-owned legal entities",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Customer not found",
      },
    },
    summary: "List legal entities for a customer workspace",
    tags: ["Operations - Customers"],
  });

  const createLegalEntityRoute = createRoute({
    method: "post",
    path: "/{customerId}/legal-entities",
    request: {
      body: {
        content: {
          "application/json": { schema: CustomerLegalEntityInputSchema },
        },
        required: true,
      },
      params: CustomerLegalEntityParamsSchema.omit({ counterpartyId: true }),
    },
    responses: {
      201: {
        content: { "application/json": { schema: CustomerLegalEntitySchema } },
        description: "Legal entity created",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Customer not found",
      },
    },
    summary: "Create a customer-owned legal entity",
    tags: ["Operations - Customers"],
  });

  const getLegalEntityRoute = createRoute({
    method: "get",
    path: "/{customerId}/legal-entities/{counterpartyId}",
    request: { params: CustomerLegalEntityParamsSchema },
    responses: {
      200: {
        content: { "application/json": { schema: CustomerLegalEntitySchema } },
        description: "Legal entity detail",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Legal entity not found",
      },
    },
    summary: "Get a customer-owned legal entity",
    tags: ["Operations - Customers"],
  });

  const updateLegalEntityRoute = createRoute({
    method: "patch",
    path: "/{customerId}/legal-entities/{counterpartyId}",
    request: {
      body: {
        content: {
          "application/json": { schema: CustomerLegalEntityPatchInputSchema },
        },
        required: true,
      },
      params: CustomerLegalEntityParamsSchema,
    },
    responses: {
      200: {
        content: { "application/json": { schema: CustomerLegalEntitySchema } },
        description: "Legal entity updated",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Legal entity not found",
      },
    },
    summary: "Update a customer-owned legal entity",
    tags: ["Operations - Customers"],
  });

  const listLegalEntityDocumentsRoute = createRoute({
    method: "get",
    path: "/{customerId}/legal-entities/{counterpartyId}/documents",
    request: { params: CustomerLegalEntityParamsSchema },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(CustomerLegalEntityDocumentSchema),
          },
        },
        description: "Legal entity documents",
      },
    },
    summary: "List documents for a legal entity",
    tags: ["Operations - Customers"],
  });

  const uploadLegalEntityDocumentRoute = createRoute({
    method: "post",
    path: "/{customerId}/legal-entities/{counterpartyId}/documents",
    request: { params: CustomerLegalEntityParamsSchema },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: CustomerLegalEntityDocumentSchema,
          },
        },
        description: "Document uploaded",
      },
    },
    summary: "Upload document for a legal entity",
    tags: ["Operations - Customers"],
  });

  const downloadLegalEntityDocumentRoute = createRoute({
    method: "get",
    path: "/{customerId}/legal-entities/{counterpartyId}/documents/{documentId}/download",
    request: { params: CustomerLegalEntityDocumentParamsSchema },
    responses: {
      200: { description: "Redirect to signed URL" },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Document not found",
      },
    },
    summary: "Download a legal-entity document",
    tags: ["Operations - Customers"],
  });

  const deleteLegalEntityDocumentRoute = createRoute({
    method: "delete",
    path: "/{customerId}/legal-entities/{counterpartyId}/documents/{documentId}",
    request: { params: CustomerLegalEntityDocumentParamsSchema },
    responses: {
      200: {
        content: { "application/json": { schema: OpsDeletedSchema } },
        description: "Document deleted",
      },
    },
    summary: "Delete a legal-entity document",
    tags: ["Operations - Customers"],
  });

  const generateLegalEntityContractRoute = createRoute({
    method: "get",
    path: "/{customerId}/legal-entities/{counterpartyId}/contract",
    request: {
      params: CustomerLegalEntityParamsSchema,
      query: z.object({
        format: z.enum(["docx", "pdf"]).default("docx"),
        lang: z.enum(["ru", "en"]).default("ru"),
      }),
    },
    responses: {
      200: { description: "Contract document" },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Legal entity or contract not found",
      },
    },
    summary: "Generate contract for a legal entity",
    tags: ["Operations - Customers"],
  });

  const upsertLegalEntityContractRoute = createRoute({
    method: "post",
    path: "/{customerId}/legal-entities/{counterpartyId}/contract",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              agentFee: z.string().optional(),
              organizationId: z.string().uuid(),
              organizationRequisiteId: z.string().uuid(),
              contractDate: z.string().optional(),
              contractNumber: z.string().optional(),
              fixedFee: z.string().optional(),
            }),
          },
        },
        required: true,
      },
      params: CustomerLegalEntityParamsSchema,
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: CustomerLegalEntityContractSchema,
          },
        },
        description: "Contract created or updated",
      },
      404: {
        content: { "application/json": { schema: OpsErrorSchema } },
        description: "Legal entity not found",
      },
    },
    summary: "Create or update contract for a legal entity",
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
      const customer = await ctx.partiesModule.customers.commands.create(canonical);
      await upsertLegalEntity(ctx, {
        customerId: customer.id,
        values: input,
      });
      const result = await getCustomerWorkspace(ctx, customer.id);
      return c.json(result, 201);
    })
    .openapi(updateRoute, async (c) => {
      const { id } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        const currentCustomer = await getCustomerOrThrow(ctx, id);
        const canonical = extractCanonicalUpdateInput(
          input,
          currentCustomer.displayName,
        );
        if (Object.keys(canonical).length > 0) {
          await ctx.partiesModule.customers.commands.update(id, canonical);
        }

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
        await getCustomerOrThrow(ctx, id);
        const counterparties = await getCustomerOwnedCounterparties(ctx, id);
        const shells = await ctx.operationsModule.clients.queries.listActiveByCounterpartyIds(
          counterparties.map((counterparty) => counterparty.id),
        );
        await Promise.all(
          shells.map((shell) =>
            ctx.operationsModule.clients.commands.softDelete(shell.id),
          ),
        );

        return c.json({ deleted: true }, 200);
      } catch (error) {
        if (error instanceof CustomerNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    })
    .openapi(listLegalEntitiesRoute, async (c) => {
      const { customerId } = c.req.valid("param");

      try {
        await getCustomerOrThrow(ctx, customerId);
        const counterparties = await getCustomerOwnedCounterparties(ctx, customerId);
        const shellMap = await listActiveShellsByCounterpartyId(
          ctx,
          counterparties.map((counterparty) => counterparty.id),
        );
        const result = await Promise.all(
          counterparties.map((counterparty) =>
            mapCustomerLegalEntity(
              ctx,
              counterparty,
              shellMap.get(counterparty.id) ?? null,
            ),
          ),
        );

        return c.json(result, 200);
      } catch (error) {
        if (error instanceof CustomerNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    })
    .openapi(createLegalEntityRoute, async (c) => {
      const { customerId } = c.req.valid("param");
      const input = c.req.valid("json");

      try {
        await getCustomerOrThrow(ctx, customerId);
        const result = await upsertLegalEntity(ctx, {
          customerId,
          values: input,
        });

        return c.json(result, 201);
      } catch (error) {
        if (error instanceof CustomerNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    })
    .openapi(getLegalEntityRoute, async (c) => {
      const { counterpartyId, customerId } = c.req.valid("param");
      const counterparty = await ensureCustomerOwnedCounterparty(ctx, {
        counterpartyId,
        customerId,
      });
      const shell = await ctx.operationsModule.clients.queries.findActiveByCounterpartyId(
        counterpartyId,
      );

      return c.json(await mapCustomerLegalEntity(ctx, counterparty, shell), 200);
    })
    .openapi(updateLegalEntityRoute, async (c) => {
      const { counterpartyId, customerId } = c.req.valid("param");
      const patch = c.req.valid("json");
      const current = await ensureCustomerOwnedCounterparty(ctx, {
        counterpartyId,
        customerId,
      });
      const shell = await ctx.operationsModule.clients.queries.findActiveByCounterpartyId(
        counterpartyId,
      );
      const values: CustomerLegalEntityInput = {
        account: patch.account ?? shell?.account ?? null,
        address: patch.address ?? shell?.address ?? null,
        addressI18n: patch.addressI18n ?? shell?.addressI18n ?? null,
        agentFee: patch.agentFee ?? null,
        agentOrganizationId: patch.agentOrganizationId ?? null,
        bankAddress: patch.bankAddress ?? shell?.bankAddress ?? null,
        bankAddressI18n:
          patch.bankAddressI18n ?? shell?.bankAddressI18n ?? null,
        bankCountry:
          patch.bankCountry ?? patch.country ?? shell?.bankCountry ?? current.country ?? null,
        bankName: patch.bankName ?? shell?.bankName ?? null,
        bankNameI18n: patch.bankNameI18n ?? shell?.bankNameI18n ?? null,
        bic: patch.bic ?? shell?.bic ?? null,
        contractDate: patch.contractDate ?? null,
        contractId: patch.contractId ?? null,
        contractNumber: patch.contractNumber ?? null,
        corrAccount: patch.corrAccount ?? shell?.corrAccount ?? null,
        counterpartyId,
        country: patch.country ?? current.country ?? null,
        customerId,
        directorBasis: patch.directorBasis ?? shell?.directorBasis ?? null,
        directorBasisI18n:
          patch.directorBasisI18n ?? shell?.directorBasisI18n ?? null,
        directorName: patch.directorName ?? shell?.directorName ?? null,
        directorNameI18n:
          patch.directorNameI18n ?? shell?.directorNameI18n ?? null,
        email: patch.email ?? shell?.email ?? null,
        fixedFee: patch.fixedFee ?? null,
        inn: patch.inn ?? shell?.inn ?? current.externalId ?? null,
        kpp: patch.kpp ?? shell?.kpp ?? null,
        organizationRequisiteId: patch.organizationRequisiteId ?? null,
        ogrn: patch.ogrn ?? shell?.ogrn ?? null,
        okpo: patch.okpo ?? shell?.okpo ?? null,
        oktmo: patch.oktmo ?? shell?.oktmo ?? null,
        orgName: patch.orgName ?? shell?.orgName ?? current.shortName,
        orgNameI18n: patch.orgNameI18n ?? shell?.orgNameI18n ?? null,
        orgType: patch.orgType ?? shell?.orgType ?? null,
        orgTypeI18n: patch.orgTypeI18n ?? shell?.orgTypeI18n ?? null,
        phone: patch.phone ?? shell?.phone ?? null,
        position: patch.position ?? shell?.position ?? null,
        positionI18n: patch.positionI18n ?? shell?.positionI18n ?? null,
        subAgentCounterpartyId:
          patch.subAgentCounterpartyId ??
          shell?.subAgentCounterpartyId ??
          null,
      };

      const result = await upsertLegalEntity(ctx, {
        counterpartyId,
        customerId,
        values,
      });
      return c.json(result, 200);
    })
    .openapi(listLegalEntityDocumentsRoute, async (c) => {
      const { counterpartyId, customerId } = c.req.valid("param");
      const docs = ctx.operationsModule.clients.documents;
      if (!docs) {
        return c.json([], 200);
      }

      const shell = await resolveLegacyShellForLegalEntity(ctx, {
        counterpartyId,
        customerId,
      });
      const result = await docs.queries.listByClientId(shell.id);
      return c.json(result.map(stripClientIdFromDocument), 200);
    })
    .openapi(uploadLegalEntityDocumentRoute, async (c) => {
      const { counterpartyId, customerId } = c.req.valid("param");
      const docs = ctx.operationsModule.clients.documents;
      if (!docs) {
        return c.json({ error: "Document storage not configured" } as any, 503 as any);
      }

      const shell = await resolveLegacyShellForLegalEntity(ctx, {
        counterpartyId,
        customerId,
      });
      const body = await c.req.parseBody();
      const file = body.file;
      if (!file || typeof file === "string") {
        return c.json({ error: "File is required" } as any, 400 as any);
      }

      const sessionUser = c.get("user")!;
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await docs.commands.upload({
        buffer,
        clientId: shell.id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: sessionUser.id,
      });
      return c.json(stripClientIdFromDocument(result), 201);
    })
    .openapi(downloadLegalEntityDocumentRoute, async (c) => {
      const { documentId } = c.req.valid("param");
      const docs = ctx.operationsModule.clients.documents;
      if (!docs) {
        return c.json({ error: "Documents not configured" }, 404);
      }

      const url = await docs.getSignedUrl(documentId);
      if (!url) {
        return c.json({ error: "Document not found" }, 404);
      }

      return c.redirect(url, 302);
    })
    .openapi(deleteLegalEntityDocumentRoute, async (c) => {
      const { documentId } = c.req.valid("param");
      const docs = ctx.operationsModule.clients.documents;
      if (docs) {
        await docs.commands.delete(documentId);
      }
      return c.json({ deleted: true }, 200);
    })
    .openapi(generateLegalEntityContractRoute, async (c) => {
      const { counterpartyId, customerId } = c.req.valid("param");
      const { format, lang } = c.req.valid("query");
      const shell = await resolveLegacyShellForLegalEntity(ctx, {
        counterpartyId,
        customerId,
      });
      const contract =
        await ctx.operationsModule.contracts.queries.findByClient(shell.id);
      if (!contract) {
        return c.json({ error: "Contract not found" }, 404);
      }

      const organization = contract.agentOrganizationId
        ? await findCanonicalOrganizationByLegacyId(
            ctx,
            contract.agentOrganizationId,
          )
        : null;
      const organizationRequisite =
        contract.organizationRequisiteId != null
          ? await getOrganizationBankRequisiteOrThrow(
              ctx,
              contract.organizationRequisiteId,
            )
          : null;
      if (!organization || !organizationRequisite) {
        return c.json({ error: "Organization not found" }, 404);
      }

      const result =
        await ctx.documentGenerationWorkflow.generateClientContract({
          client: shell as unknown as Record<string, unknown>,
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
    .openapi(upsertLegalEntityContractRoute, async (c) => {
      const { counterpartyId, customerId } = c.req.valid("param");
      const input = c.req.valid("json");
      const shell = await resolveLegacyShellForLegalEntity(ctx, {
        counterpartyId,
        customerId,
      });
      const existing =
        await ctx.operationsModule.contracts.queries.findByClient(shell.id);

      try {
        const legacyOrganization =
          await resolveLegacyHoldingOrganizationByCanonicalId(
            input.organizationId,
          );
        const requisite = await getOrganizationBankRequisiteOrThrow(
          ctx,
          input.organizationRequisiteId,
        );
        if (requisite.ownerId !== input.organizationId) {
          return c.json(
            { error: "Organization requisite does not belong to organization" },
            400,
          );
        }
        if (existing) {
          const updated = await ctx.operationsModule.contracts.commands.update({
            agentOrganizationId: legacyOrganization.id,
            agentFee: input.agentFee,
            contractDate: input.contractDate,
            contractNumber: input.contractNumber,
            fixedFee: input.fixedFee,
            id: existing.id,
            organizationRequisiteId: input.organizationRequisiteId,
          });
          return c.json(await serializeContractForPublic(ctx, updated!), 201);
        }

        const created = await ctx.operationsModule.contracts.commands.create({
          agentOrganizationId: legacyOrganization.id,
          agentFee: input.agentFee,
          clientId: shell.id,
          contractDate: input.contractDate,
          contractNumber: input.contractNumber,
          fixedFee: input.fixedFee,
          organizationRequisiteId: input.organizationRequisiteId,
        });
        return c.json(await serializeContractForPublic(ctx, created), 201);
      } catch (error) {
        if (error instanceof OrganizationNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        throw error;
      }
    });
}
