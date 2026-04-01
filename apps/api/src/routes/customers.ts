import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import ExcelJS from "exceljs";

import {
  CustomerDeleteConflictError,
  CustomerNotFoundError,
} from "@bedrock/parties";
import { NotFoundError } from "@bedrock/shared/core/errors";
import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";
import { createCustomerBankingService } from "@bedrock/workflow-customer-portal";

import { DeletedSchema, ErrorSchema } from "../common";
import {
  assertCustomerOwnsCounterparty,
  createCustomerAgreementForCustomer,
  CustomerAgreementSchema,
  resolveEffectiveCustomerAgreementByCustomerId,
  updateCustomerAgreement,
} from "./customer-agreements";
import {
  getOrganizationBankRequisiteOrThrow,
  serializeOrganizationRequisiteForDocuments,
} from "./organization-requisites";
import { handleRouteError } from "../common/errors";
import type { AppContext } from "../context";
import {
  CustomerFileAttachmentSchema,
  GeneratedDocumentFormatSchema,
  GeneratedDocumentLangSchema,
  serializeCustomerFileAttachment,
} from "./customer-files";
import type { AuthVariables } from "../middleware/auth";
import { withRequiredIdempotency } from "../middleware/idempotency";
import { requirePermission } from "../middleware/permission";

const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, name: "Calibri", size: 11 },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } },
};

const LocalizedTextSchema = z
  .object({
    ru: z.string().nullable().optional(),
    en: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

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
  account: z.string().nullable(),
  address: z.string().nullable(),
  addressI18n: LocalizedTextSchema,
  bankAddress: z.string().nullable(),
  bankAddressI18n: LocalizedTextSchema,
  bankCountry: z.string().nullable(),
  bankName: z.string().nullable(),
  bankNameI18n: LocalizedTextSchema,
  bankProviderId: z.string().uuid().nullable().optional(),
  bic: z.string().nullable(),
  beneficiaryName: z.string().nullable(),
  contractNumber: z.string().nullable(),
  corrAccount: z.string().nullable(),
  counterpartyId: z.string().uuid(),
  country: z.string().nullable(),
  createdAt: z.string(),
  directorBasis: z.string().nullable(),
  directorBasisI18n: LocalizedTextSchema,
  directorName: z.string().nullable(),
  directorNameI18n: LocalizedTextSchema,
  email: z.string().nullable(),
  externalId: z.string().nullable(),
  fullName: z.string(),
  inn: z.string().nullable(),
  iban: z.string().nullable(),
  kpp: z.string().nullable(),
  ogrn: z.string().nullable(),
  okpo: z.string().nullable(),
  oktmo: z.string().nullable(),
  orgName: z.string(),
  orgNameI18n: LocalizedTextSchema,
  orgType: z.string().nullable(),
  orgTypeI18n: LocalizedTextSchema,
  phone: z.string().nullable(),
  position: z.string().nullable(),
  positionI18n: LocalizedTextSchema,
  relationshipKind: z.enum(["customer_owned", "external"]),
  shortName: z.string(),
  subAgent: z.any().nullable(),
  subAgentCounterpartyId: z.string().uuid().nullable(),
  swift: z.string().nullable(),
  updatedAt: z.string(),
});

const CustomerBankProviderInputSchema = z.object({
  address: z.string().trim().nullable().optional(),
  country: z.string().trim().nullable().optional(),
  name: z.string().trim().nullable().optional(),
  routingCode: z.string().trim().nullable().optional(),
});

const CustomerBankRequisiteInputSchema = z.object({
  accountNo: z.string().trim().nullable().optional(),
  beneficiaryName: z.string().trim().nullable().optional(),
  corrAccount: z.string().trim().nullable().optional(),
  iban: z.string().trim().nullable().optional(),
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

const CustomerLegalEntityDocumentParamsSchema =
  CustomerLegalEntityParamsSchema.extend({
    documentId: z.string().uuid().openapi({
      param: {
        in: "path",
        name: "documentId",
      },
    }),
  });

const CustomerLegalEntityInputSchema = z.object({
  account: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  addressI18n: LocalizedTextSchema,
  bankAddress: z.string().trim().nullable().optional(),
  bankAddressI18n: LocalizedTextSchema,
  bankCountry: z.string().trim().nullable().optional(),
  bankMode: z.enum(["existing", "manual"]).optional(),
  bankName: z.string().trim().nullable().optional(),
  bankNameI18n: LocalizedTextSchema,
  bankProvider: CustomerBankProviderInputSchema.optional(),
  bankProviderId: z.string().uuid().nullable().optional(),
  bankRequisite: CustomerBankRequisiteInputSchema.optional(),
  bic: z.string().trim().nullable().optional(),
  beneficiaryName: z.string().trim().nullable().optional(),
  corrAccount: z.string().trim().nullable().optional(),
  country: z.string().trim().nullable().optional(),
  directorBasis: z.string().trim().nullable().optional(),
  directorBasisI18n: LocalizedTextSchema,
  directorName: z.string().trim().nullable().optional(),
  directorNameI18n: LocalizedTextSchema,
  email: z
    .preprocess(
      (value) => (value === "" ? null : value),
      z.string().email().nullable().optional(),
    )
    .nullable()
    .optional(),
  inn: z.string().trim().nullable().optional(),
  iban: z.string().trim().nullable().optional(),
  kpp: z.string().trim().nullable().optional(),
  ogrn: z.string().trim().nullable().optional(),
  okpo: z.string().trim().nullable().optional(),
  oktmo: z.string().trim().nullable().optional(),
  orgName: z.string().trim().min(1),
  orgNameI18n: LocalizedTextSchema,
  orgType: z.string().trim().nullable().optional(),
  orgTypeI18n: LocalizedTextSchema,
  phone: z.string().trim().nullable().optional(),
  position: z.string().trim().nullable().optional(),
  positionI18n: LocalizedTextSchema,
  subAgentCounterpartyId: z.string().uuid().nullable().optional(),
  swift: z.string().trim().nullable().optional(),
});

const CustomerLegalEntityPatchInputSchema =
  CustomerLegalEntityInputSchema.partial();

const CustomerWorkspaceUpsertInputSchema = CustomerLegalEntityInputSchema.extend({
  description: z.string().trim().nullable().optional(),
  displayName: z.string().trim().min(1).optional(),
  externalRef: z.string().trim().nullable().optional(),
});

const CustomerWorkspacePatchInputSchema = z.object({
  description: z.string().trim().nullable().optional(),
  displayName: z.string().trim().min(1).optional(),
  externalRef: z.string().trim().nullable().optional(),
});

const CustomerBankProviderSearchQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(8),
  query: z.string().trim().min(1),
});

const CustomerBankProviderSearchResultSchema = z.object({
  address: z.string().nullable(),
  bic: z.string().nullable(),
  country: z.string().nullable(),
  displayLabel: z.string(),
  id: z.string().uuid(),
  name: z.string(),
  swift: z.string().nullable(),
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
type CustomerWorkspaceSummary = z.infer<typeof CustomerWorkspaceSummarySchema>;
type CanonicalCustomer = Awaited<
  ReturnType<AppContext["partiesModule"]["customers"]["queries"]["findById"]>
>;
type CanonicalCounterpartyListItem = Awaited<
  ReturnType<AppContext["partiesModule"]["counterparties"]["queries"]["list"]>
>["data"][number];
type CounterpartyBankRequisite = Awaited<
  ReturnType<AppContext["partiesModule"]["requisites"]["queries"]["findById"]>
> | null;

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

function deriveRoutingCode(input: {
  bankProvider?: z.infer<typeof CustomerBankProviderInputSchema>;
  bankCountry?: string | null | undefined;
  bic?: string | null | undefined;
  country?: string | null | undefined;
  swift?: string | null | undefined;
}) {
  const routingCode =
    normalizeNullableText(input.bankProvider?.routingCode)?.toUpperCase() ?? null;
  const bic = normalizeNullableText(input.bic);
  const swift = normalizeNullableText(input.swift)?.toUpperCase() ?? null;
  const country = normalizeCountryCode(
    input.bankProvider?.country ?? input.bankCountry ?? input.country,
  );

  if (routingCode) {
    return routingCode;
  }

  if (bic || swift) {
    return bic ?? swift;
  }

  return country === "RU" ? bic : swift;
}

function buildCustomerBankingInput(input: CustomerLegalEntityInput) {
  const providerCountry = normalizeCountryCode(
    input.bankProvider?.country ?? input.bankCountry ?? input.country,
  );

  return {
    bankProvider: {
      address:
        normalizeNullableText(input.bankProvider?.address) ??
        normalizeNullableText(input.bankAddress),
      country: providerCountry,
      name:
        normalizeNullableText(input.bankProvider?.name) ??
        normalizeNullableText(input.bankName),
      routingCode: deriveRoutingCode(input),
    },
    bankProviderId: normalizeNullableText(input.bankProviderId),
    bankRequisite: {
      accountNo:
        normalizeNullableText(input.bankRequisite?.accountNo) ??
        normalizeNullableText(input.account),
      beneficiaryName:
        normalizeNullableText(input.bankRequisite?.beneficiaryName) ??
        normalizeNullableText(input.beneficiaryName),
      corrAccount:
        normalizeNullableText(input.bankRequisite?.corrAccount) ??
        normalizeNullableText(input.corrAccount),
      iban:
        normalizeNullableText(input.bankRequisite?.iban) ??
        normalizeNullableText(input.iban),
    },
    country: normalizeCountryCode(input.country ?? input.bankCountry),
    orgName: input.orgName,
  };
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
    CustomerWorkspacePatchInput & { orgName?: string },
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
  values: Pick<CustomerLegalEntityInput, keyof CustomerLegalEntityInput>;
}) {
  return {
    address: normalizeNullableText(input.values.address),
    addressI18n: input.values.addressI18n ?? null,
    country: normalizeCountryCode(input.values.country ?? input.values.bankCountry),
    customerId: input.customerId,
    description: null,
    directorBasis: normalizeNullableText(input.values.directorBasis),
    directorBasisI18n: input.values.directorBasisI18n ?? null,
    directorName: normalizeNullableText(input.values.directorName),
    directorNameI18n: input.values.directorNameI18n ?? null,
    email: normalizeNullableText(input.values.email),
    externalId: normalizeNullableText(input.values.inn),
    fullName: input.values.orgName,
    inn: normalizeNullableText(input.values.inn),
    kind: "legal_entity" as const,
    kpp: normalizeNullableText(input.values.kpp),
    ogrn: normalizeNullableText(input.values.ogrn),
    okpo: normalizeNullableText(input.values.okpo),
    oktmo: normalizeNullableText(input.values.oktmo),
    orgNameI18n: input.values.orgNameI18n ?? null,
    orgType: normalizeNullableText(input.values.orgType),
    orgTypeI18n: input.values.orgTypeI18n ?? null,
    phone: normalizeNullableText(input.values.phone),
    position: normalizeNullableText(input.values.position),
    positionI18n: input.values.positionI18n ?? null,
    relationshipKind: "customer_owned" as const,
    shortName: input.values.orgName,
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

async function listCounterpartyAssignments(
  ctx: AppContext,
  counterpartyIds: string[],
) {
  return ctx.partiesReadRuntime.counterpartiesQueries.listAssignmentsByCounterpartyIds(
    counterpartyIds,
  );
}

async function listCounterpartyBankRequisites(
  ctx: AppContext,
  counterpartyIds: string[],
) {
  const rows = await Promise.all(
    counterpartyIds.map(async (counterpartyId) => {
      const result = await ctx.partiesModule.requisites.queries.list({
        kind: ["bank"],
        limit: 50,
        offset: 0,
        ownerId: counterpartyId,
        ownerType: "counterparty",
        sortBy: "createdAt",
        sortOrder: "desc",
      });
      const preferred =
        result.data.find((item) => item.isDefault && item.archivedAt === null) ??
        result.data.find((item) => item.archivedAt === null) ??
        null;
      return [counterpartyId, preferred] as const;
    }),
  );

  return new Map<string, CounterpartyBankRequisite>(rows);
}

async function upsertCounterpartyAssignment(input: {
  ctx: AppContext;
  counterpartyId: string;
  subAgentCounterpartyId: string | null;
}) {
  await input.ctx.partiesReadRuntime.counterpartiesQueries.upsertAssignment({
    counterpartyId: input.counterpartyId,
    subAgentCounterpartyId: input.subAgentCounterpartyId,
  });
}

async function mapCustomerLegalEntity(input: {
  assignment: {
    counterpartyId: string;
    subAgentCounterpartyId: string | null;
  } | null;
  bankRequisite: CounterpartyBankRequisite;
  contract?: z.infer<typeof CustomerAgreementSchema> | null;
  counterparty: CanonicalCounterpartyListItem;
  ctx: AppContext;
}) {
  const subAgent = input.assignment?.subAgentCounterpartyId
    ? await input.ctx.partiesModule.subAgentProfiles.queries.findById(
        input.assignment.subAgentCounterpartyId,
      )
    : null;
  const provider = input.bankRequisite?.providerId
    ? await input.ctx.partiesModule.requisites.queries.findProviderById(
        input.bankRequisite.providerId,
      )
    : null;

  return {
    account: input.bankRequisite?.accountNo ?? null,
    address: input.counterparty.address ?? null,
    addressI18n: input.counterparty.addressI18n ?? null,
    bankAddress: provider?.address ?? null,
    bankAddressI18n: null,
    bankCountry: provider?.country ?? null,
    bankName: provider?.name ?? null,
    bankNameI18n: null,
    bankProviderId: provider?.id ?? null,
    bic: provider?.bic ?? null,
    beneficiaryName: input.bankRequisite?.beneficiaryName ?? null,
    contractNumber: input.contract?.contractNumber ?? null,
    corrAccount: input.bankRequisite?.corrAccount ?? null,
    counterpartyId: input.counterparty.id,
    country: input.counterparty.country ?? null,
    createdAt: serializeDate(input.counterparty.createdAt),
    directorBasis: input.counterparty.directorBasis ?? null,
    directorBasisI18n: input.counterparty.directorBasisI18n ?? null,
    directorName: input.counterparty.directorName ?? null,
    directorNameI18n: input.counterparty.directorNameI18n ?? null,
    email: input.counterparty.email ?? null,
    externalId: input.counterparty.externalId,
    fullName: input.counterparty.fullName,
    inn: input.counterparty.inn ?? input.counterparty.externalId ?? null,
    iban: input.bankRequisite?.iban ?? null,
    kpp: input.counterparty.kpp ?? null,
    ogrn: input.counterparty.ogrn ?? null,
    okpo: input.counterparty.okpo ?? null,
    oktmo: input.counterparty.oktmo ?? null,
    orgName: input.counterparty.shortName,
    orgNameI18n: input.counterparty.orgNameI18n ?? null,
    orgType: input.counterparty.orgType ?? null,
    orgTypeI18n: input.counterparty.orgTypeI18n ?? null,
    phone: input.counterparty.phone ?? null,
    position: input.counterparty.position ?? null,
    positionI18n: input.counterparty.positionI18n ?? null,
    relationshipKind: input.counterparty.relationshipKind,
    shortName: input.counterparty.shortName,
    subAgent,
    subAgentCounterpartyId: input.assignment?.subAgentCounterpartyId ?? null,
    swift: provider?.swift ?? null,
    updatedAt: serializeDate(input.counterparty.updatedAt),
  };
}

async function mapCustomerWorkspaceSummary(
  customer: CanonicalCustomer,
  counterpartiesByCustomerId: Map<string, CanonicalCounterpartyListItem[]>,
) {
  const counterparties = counterpartiesByCustomerId.get(customer.id) ?? [];
  const primaryCounterparty = counterparties[0] ?? null;

  return {
    createdAt: serializeDate(customer.createdAt),
    description: customer.description,
    directorName: primaryCounterparty?.directorName ?? null,
    displayName: customer.displayName,
    email: primaryCounterparty?.email ?? null,
    externalRef: customer.externalRef,
    id: customer.id,
    inn: primaryCounterparty?.inn ?? primaryCounterparty?.externalId ?? null,
    legalEntityCount: counterparties.length,
    phone: primaryCounterparty?.phone ?? null,
    primaryCounterpartyId: primaryCounterparty?.id ?? null,
    updatedAt: serializeDate(customer.updatedAt),
  } satisfies CustomerWorkspaceSummary;
}

async function mapCustomerWorkspaceDetail(
  ctx: AppContext,
  customer: CanonicalCustomer,
  counterpartiesList: CanonicalCounterpartyListItem[],
) {
  const assignments = await listCounterpartyAssignments(
    ctx,
    counterpartiesList.map((counterparty) => counterparty.id),
  );
  const requisitesByCounterpartyId = await listCounterpartyBankRequisites(
    ctx,
    counterpartiesList.map((counterparty) => counterparty.id),
  );
  const contract = await resolveEffectiveCustomerAgreementByCustomerId(
    ctx,
    customer.id,
  );
  const legalEntities = await Promise.all(
    counterpartiesList.map((counterparty) =>
      mapCustomerLegalEntity({
        assignment: assignments.get(counterparty.id) ?? null,
        bankRequisite: requisitesByCounterpartyId.get(counterparty.id) ?? null,
        contract,
        counterparty,
        ctx,
      }),
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
    throw new NotFoundError("Customer counterparty", input.counterpartyId);
  }

  return counterparty;
}

async function upsertLegalEntity(
  ctx: AppContext,
  input: {
    counterpartyId?: string;
    customerId: string;
    values: CustomerLegalEntityInput;
  },
) {
  const customerBankingService = createCustomerBankingService({
    currencies: ctx.currenciesService,
    logger: ctx.logger,
    requisites: ctx.partiesModule.requisites,
  });
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

  await upsertCounterpartyAssignment({
    ctx,
    counterpartyId,
    subAgentCounterpartyId:
      normalizeNullableText(input.values.subAgentCounterpartyId) ?? null,
  });
  await customerBankingService.upsertCounterpartyBankRequisite({
    counterpartyId,
    values: buildCustomerBankingInput(input.values),
  });

  const counterparty = await ensureCustomerOwnedCounterparty(ctx, {
    counterpartyId,
    customerId: input.customerId,
  });
  const contract = await resolveEffectiveCustomerAgreementByCustomerId(
    ctx,
    input.customerId,
  );
  const assignments = await listCounterpartyAssignments(ctx, [counterpartyId]);
  const requisitesByCounterpartyId = await listCounterpartyBankRequisites(ctx, [
    counterpartyId,
  ]);

  return mapCustomerLegalEntity({
    assignment: assignments.get(counterpartyId) ?? null,
    bankRequisite: requisitesByCounterpartyId.get(counterpartyId) ?? null,
    contract,
    counterparty,
    ctx,
  });
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

    return {
      data: await Promise.all(
        customers.data.map((customer) =>
          mapCustomerWorkspaceSummary(customer, counterpartiesByCustomerId),
        ),
      ),
      limit: query.limit,
      offset: query.offset,
      total: customers.total,
    };
  }

  const [displayNameMatches, externalRefMatches, counterpartyMatches] =
    await Promise.all([
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
      ctx.partiesReadRuntime.counterpartiesQueries.listCustomerIdsByCustomerOwnedCounterpartySearch(
        {
          limit: 1000,
          q: query.q,
        },
      ),
    ]);

  const customerMap = new Map<string, CanonicalCustomer>();
  for (const customer of [...displayNameMatches.data, ...externalRefMatches.data]) {
    customerMap.set(customer.id, customer);
  }

  if (counterpartyMatches.length > 0) {
    const customers = await ctx.partiesModule.customers.queries.listByIds(
      counterpartyMatches,
    );
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
  const rows = await Promise.all(
    customers.map((customer) =>
      mapCustomerWorkspaceSummary(customer, counterpartiesByCustomerId),
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
  const counterpartiesList = await getCustomerOwnedCounterparties(ctx, customerId);
  return mapCustomerWorkspaceDetail(ctx, customer, counterpartiesList);
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

export function customersRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  const listRoute = createRoute({
    middleware: [requirePermission({ customers: ["list"] })],
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
    tags: ["Customers"],
  });

  const exportRoute = createRoute({
    middleware: [requirePermission({ customers: ["list"] })],
    method: "get",
    path: "/export/xlsx",
    responses: { 200: { description: "Customer workspace XLSX file" } },
    summary: "Export customer workspaces to XLSX",
    tags: ["Customers"],
  });

  const getRoute = createRoute({
    middleware: [requirePermission({ customers: ["list"] })],
    method: "get",
    path: "/{id}",
    request: { params: CustomerWorkspaceParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: CustomerWorkspaceDetailSchema } },
        description: "Customer workspace detail",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Customer not found",
      },
    },
    summary: "Get a customer workspace by canonical customer ID",
    tags: ["Customers"],
  });

  const createRoute_ = createRoute({
    middleware: [requirePermission({ customers: ["create"] })],
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
    tags: ["Customers"],
  });

  const updateRoute = createRoute({
    middleware: [requirePermission({ customers: ["update"] })],
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
        content: { "application/json": { schema: ErrorSchema } },
        description: "Customer not found",
      },
    },
    summary: "Update canonical customer identity",
    tags: ["Customers"],
  });

  const deleteRoute = createRoute({
    middleware: [requirePermission({ customers: ["delete"] })],
    method: "delete",
    path: "/{id}",
    request: { params: CustomerWorkspaceParamSchema },
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
    summary: "Delete canonical customer",
    tags: ["Customers"],
  });

  const listLegalEntitiesRoute = createRoute({
    middleware: [requirePermission({ customers: ["list"] })],
    method: "get",
    path: "/{customerId}/legal-entities",
    request: { params: CustomerLegalEntityParamsSchema.omit({ counterpartyId: true }) },
    responses: {
      200: {
        content: { "application/json": { schema: z.array(CustomerLegalEntitySchema) } },
        description: "Customer-owned legal entities",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Customer not found",
      },
    },
    summary: "List legal entities for a customer workspace",
    tags: ["Customers"],
  });

  const searchBankProvidersRoute = createRoute({
    middleware: [requirePermission({ customers: ["create", "update"] })],
    method: "get",
    path: "/bank-providers",
    request: {
      query: CustomerBankProviderSearchQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              data: z.array(CustomerBankProviderSearchResultSchema),
            }),
          },
        },
        description: "Bank provider matches",
      },
    },
    summary: "Search bank providers for CRM customer forms",
    tags: ["Customers"],
  });

  const createLegalEntityRoute = createRoute({
    middleware: [requirePermission({ customers: ["update"] })],
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
        content: { "application/json": { schema: ErrorSchema } },
        description: "Customer not found",
      },
    },
    summary: "Create a customer-owned legal entity",
    tags: ["Customers"],
  });

  const getLegalEntityRoute = createRoute({
    middleware: [requirePermission({ customers: ["list"] })],
    method: "get",
    path: "/{customerId}/legal-entities/{counterpartyId}",
    request: { params: CustomerLegalEntityParamsSchema },
    responses: {
      200: {
        content: { "application/json": { schema: CustomerLegalEntitySchema } },
        description: "Legal entity detail",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Legal entity not found",
      },
    },
    summary: "Get a customer-owned legal entity",
    tags: ["Customers"],
  });

  const updateLegalEntityRoute = createRoute({
    middleware: [requirePermission({ customers: ["update"] })],
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
        content: { "application/json": { schema: ErrorSchema } },
        description: "Legal entity not found",
      },
    },
    summary: "Update a customer-owned legal entity",
    tags: ["Customers"],
  });

  const listLegalEntityDocumentsRoute = createRoute({
    middleware: [requirePermission({ customers: ["list"] })],
    method: "get",
    path: "/{customerId}/legal-entities/{counterpartyId}/documents",
    request: { params: CustomerLegalEntityParamsSchema },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.array(CustomerFileAttachmentSchema),
          },
        },
        description: "Legal entity documents",
      },
    },
    summary: "List documents for a legal entity",
    tags: ["Customers"],
  });

  const uploadLegalEntityDocumentRoute = createRoute({
    middleware: [requirePermission({ customers: ["update"] })],
    method: "post",
    path: "/{customerId}/legal-entities/{counterpartyId}/documents",
    request: { params: CustomerLegalEntityParamsSchema },
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
    summary: "Upload document for a legal entity",
    tags: ["Customers"],
  });

  const downloadLegalEntityDocumentRoute = createRoute({
    middleware: [requirePermission({ customers: ["list"] })],
    method: "get",
    path: "/{customerId}/legal-entities/{counterpartyId}/documents/{documentId}/download",
    request: { params: CustomerLegalEntityDocumentParamsSchema },
    responses: {
      200: { description: "Redirect to signed URL" },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Document not found",
      },
    },
    summary: "Download a legal-entity document",
    tags: ["Customers"],
  });

  const deleteLegalEntityDocumentRoute = createRoute({
    middleware: [requirePermission({ customers: ["update"] })],
    method: "delete",
    path: "/{customerId}/legal-entities/{counterpartyId}/documents/{documentId}",
    request: { params: CustomerLegalEntityDocumentParamsSchema },
    responses: {
      200: {
        content: { "application/json": { schema: DeletedSchema } },
        description: "Document deleted",
      },
    },
    summary: "Delete a legal-entity document",
    tags: ["Customers"],
  });

  const generateLegalEntityContractRoute = createRoute({
    middleware: [requirePermission({ agreements: ["list"] })],
    method: "get",
    path: "/{customerId}/legal-entities/{counterpartyId}/contract",
    request: {
      params: CustomerLegalEntityParamsSchema,
      query: z.object({
        format: GeneratedDocumentFormatSchema,
        lang: GeneratedDocumentLangSchema,
      }),
    },
    responses: {
      200: { description: "Contract document" },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Legal entity or contract not found",
      },
    },
    summary: "Generate contract for a legal entity",
    tags: ["Customers"],
  });

  const upsertLegalEntityContractRoute = createRoute({
    middleware: [requirePermission({ agreements: ["create", "update"] })],
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
            schema: CustomerAgreementSchema,
          },
        },
        description: "Contract created or updated",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Legal entity not found",
      },
    },
    summary: "Create or update contract for a legal entity",
    tags: ["Customers"],
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
      try {
        const query = c.req.valid("query");
        const result = await listCustomerWorkspaces(ctx, query);
        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(searchBankProvidersRoute, async (c) => {
      const query = c.req.valid("query");
      const customerBankingService = createCustomerBankingService({
        currencies: ctx.currenciesService,
        logger: ctx.logger,
        requisites: ctx.partiesModule.requisites,
      });
      const data = await customerBankingService.searchBankProviders(query);
      return c.json({ data }, 200);
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

        return handleRouteError(c, error);
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

        return handleRouteError(c, error);
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

        return handleRouteError(c, error);
      }
    })
    .openapi(listLegalEntitiesRoute, async (c) => {
      const { customerId } = c.req.valid("param");

      try {
        await getCustomerOrThrow(ctx, customerId);
        const counterpartiesList = await getCustomerOwnedCounterparties(
          ctx,
          customerId,
        );
        const assignments = await listCounterpartyAssignments(
          ctx,
          counterpartiesList.map((counterparty) => counterparty.id),
        );
        const requisitesByCounterpartyId = await listCounterpartyBankRequisites(
          ctx,
          counterpartiesList.map((counterparty) => counterparty.id),
        );
        const contract = await resolveEffectiveCustomerAgreementByCustomerId(
          ctx,
          customerId,
        );
        const result = await Promise.all(
          counterpartiesList.map((counterparty) =>
            mapCustomerLegalEntity({
              assignment: assignments.get(counterparty.id) ?? null,
              bankRequisite: requisitesByCounterpartyId.get(counterparty.id) ?? null,
              contract,
              counterparty,
              ctx,
            }),
          ),
        );

        return c.json(result, 200);
      } catch (error) {
        if (error instanceof CustomerNotFoundError) {
          return c.json({ error: error.message }, 404);
        }

        return handleRouteError(c, error);
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

        return handleRouteError(c, error);
      }
    })
    .openapi(getLegalEntityRoute, async (c) => {
      try {
        const { counterpartyId, customerId } = c.req.valid("param");
        const counterparty = await ensureCustomerOwnedCounterparty(ctx, {
          counterpartyId,
          customerId,
        });
        const contract = await resolveEffectiveCustomerAgreementByCustomerId(
          ctx,
          customerId,
        );
        const assignments = await listCounterpartyAssignments(ctx, [counterpartyId]);
        const requisitesByCounterpartyId = await listCounterpartyBankRequisites(
          ctx,
          [counterpartyId],
        );

        return c.json(
          await mapCustomerLegalEntity({
            assignment: assignments.get(counterpartyId) ?? null,
            bankRequisite: requisitesByCounterpartyId.get(counterpartyId) ?? null,
            contract,
            counterparty,
            ctx,
          }),
          200,
        );
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(updateLegalEntityRoute, async (c) => {
      try {
        const { counterpartyId, customerId } = c.req.valid("param");
        const patch = c.req.valid("json");
        const current = await ensureCustomerOwnedCounterparty(ctx, {
          counterpartyId,
          customerId,
        });
        const assignments = await listCounterpartyAssignments(ctx, [counterpartyId]);
        const currentAssignment = assignments.get(counterpartyId) ?? null;
        const requisitesByCounterpartyId = await listCounterpartyBankRequisites(
          ctx,
          [counterpartyId],
        );
        const currentBankRequisite =
          requisitesByCounterpartyId.get(counterpartyId) ?? null;
        const currentBankProvider = currentBankRequisite?.providerId
          ? await ctx.partiesModule.requisites.queries.findProviderById(
              currentBankRequisite.providerId,
            )
          : null;
        const currentRoutingCode =
          currentBankProvider?.country === "RU"
            ? currentBankProvider?.bic ?? null
            : currentBankProvider?.swift ?? currentBankProvider?.bic ?? null;
        const values: CustomerLegalEntityInput = {
          account: patch.account ?? currentBankRequisite?.accountNo ?? null,
          address: patch.address ?? current.address ?? null,
          addressI18n: patch.addressI18n ?? current.addressI18n ?? null,
          bankAddress: patch.bankAddress ?? currentBankProvider?.address ?? null,
          bankAddressI18n: patch.bankAddressI18n ?? null,
          bankMode:
            patch.bankMode ??
            ((patch.bankProviderId ?? currentBankProvider?.id)
              ? "existing"
              : "manual"),
          bankProviderId:
            patch.bankProviderId ?? currentBankProvider?.id ?? null,
          bankProvider: {
            address:
              patch.bankProvider?.address ??
              patch.bankAddress ??
              currentBankProvider?.address ??
              null,
            country:
              patch.bankProvider?.country ??
              patch.bankCountry ??
              patch.country ??
              currentBankProvider?.country ??
              current.country ??
              null,
            name:
              patch.bankProvider?.name ??
              patch.bankName ??
              currentBankProvider?.name ??
              null,
            routingCode:
              patch.bankProvider?.routingCode ??
              currentRoutingCode,
          },
          bankCountry:
            patch.bankCountry ??
            patch.country ??
            currentBankProvider?.country ??
            current.country ??
            null,
          bankName:
            patch.bankName ??
            currentBankProvider?.name ??
            null,
          bankNameI18n: patch.bankNameI18n ?? null,
          bankRequisite: {
            accountNo:
              patch.bankRequisite?.accountNo ??
              patch.account ??
              currentBankRequisite?.accountNo ??
              null,
            beneficiaryName:
              patch.bankRequisite?.beneficiaryName ??
              patch.beneficiaryName ??
              currentBankRequisite?.beneficiaryName ??
              null,
            corrAccount:
              patch.bankRequisite?.corrAccount ??
              patch.corrAccount ??
              currentBankRequisite?.corrAccount ??
              null,
            iban:
              patch.bankRequisite?.iban ??
              patch.iban ??
              currentBankRequisite?.iban ??
              null,
          },
          bic:
            patch.bic ??
            currentBankProvider?.bic ??
            null,
          beneficiaryName:
            patch.beneficiaryName ??
            currentBankRequisite?.beneficiaryName ??
            null,
          corrAccount:
            patch.corrAccount ?? currentBankRequisite?.corrAccount ?? null,
          country: patch.country ?? current.country ?? null,
          directorBasis: patch.directorBasis ?? current.directorBasis ?? null,
          directorBasisI18n:
            patch.directorBasisI18n ?? current.directorBasisI18n ?? null,
          directorName: patch.directorName ?? current.directorName ?? null,
          directorNameI18n:
            patch.directorNameI18n ?? current.directorNameI18n ?? null,
          email: patch.email ?? current.email ?? null,
          inn: patch.inn ?? current.inn ?? current.externalId ?? null,
          iban: patch.iban ?? currentBankRequisite?.iban ?? null,
          kpp: patch.kpp ?? current.kpp ?? null,
          ogrn: patch.ogrn ?? current.ogrn ?? null,
          okpo: patch.okpo ?? current.okpo ?? null,
          oktmo: patch.oktmo ?? current.oktmo ?? null,
          orgName: patch.orgName ?? current.shortName,
          orgNameI18n: patch.orgNameI18n ?? current.orgNameI18n ?? null,
          orgType: patch.orgType ?? current.orgType ?? null,
          orgTypeI18n: patch.orgTypeI18n ?? current.orgTypeI18n ?? null,
          phone: patch.phone ?? current.phone ?? null,
          position: patch.position ?? current.position ?? null,
          positionI18n: patch.positionI18n ?? current.positionI18n ?? null,
          subAgentCounterpartyId:
            patch.subAgentCounterpartyId ??
            currentAssignment?.subAgentCounterpartyId ??
            null,
          swift:
            patch.swift ??
            currentBankProvider?.swift ??
            null,
        };

        const result = await upsertLegalEntity(ctx, {
          counterpartyId,
          customerId,
          values,
        });
        return c.json(result, 200);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(listLegalEntityDocumentsRoute, async (c) => {
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
        return c.json(
          result.map(serializeCustomerFileAttachment),
          200,
        );
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(uploadLegalEntityDocumentRoute, async (c) => {
      try {
        const { counterpartyId, customerId } = c.req.valid("param");
        await assertCustomerOwnsCounterparty(ctx, {
          counterpartyId,
          customerId,
        });
        const body = await c.req.parseBody();
        const file = body.file;
        if (!file || typeof file === "string") {
          return c.json({ error: "File is required" }, 400 as const);
        }

        const sessionUser = c.get("user")!;
        const buffer = Buffer.from(await file.arrayBuffer());
        const result =
          await ctx.filesModule.files.commands.uploadCounterpartyAttachment({
            buffer,
            description:
              typeof body.description === "string" ? body.description : null,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            ownerId: counterpartyId,
            uploadedBy: sessionUser.id,
          });
        return c.json(serializeCustomerFileAttachment(result), 201);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(downloadLegalEntityDocumentRoute, async (c) => {
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
    .openapi(deleteLegalEntityDocumentRoute, async (c) => {
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
    .openapi(generateLegalEntityContractRoute, async (c) => {
      try {
        const { counterpartyId, customerId } = c.req.valid("param");
        const { format, lang } = c.req.valid("query");
        await assertCustomerOwnsCounterparty(ctx, {
          counterpartyId,
          customerId,
        });

        const contract = await resolveEffectiveCustomerAgreementByCustomerId(
          ctx,
          customerId,
        );
        if (!contract) {
          return c.json({ error: "Contract not found" }, 404);
        }

        const counterparty = await ensureCustomerOwnedCounterparty(ctx, {
          counterpartyId,
          customerId,
        });
        const assignments = await listCounterpartyAssignments(ctx, [counterpartyId]);
        const requisitesByCounterpartyId = await listCounterpartyBankRequisites(
          ctx,
          [counterpartyId],
        );
        const legalEntity = await mapCustomerLegalEntity({
          assignment: assignments.get(counterpartyId) ?? null,
          bankRequisite: requisitesByCounterpartyId.get(counterpartyId) ?? null,
          contract,
          counterparty,
          ctx,
        });

        const organization =
          await ctx.partiesModule.organizations.queries.findById(
            contract.organizationId,
          );
        const organizationRequisite = await getOrganizationBankRequisiteOrThrow(
          ctx,
          contract.organizationRequisiteId,
        );
        if (!organization || organizationRequisite.ownerId !== organization.id) {
          return c.json({ error: "Organization not found" }, 404);
        }

        const result =
          await ctx.documentGenerationWorkflow.generateClientContract({
            client: legalEntity as unknown as Record<string, unknown>,
            contract: contract as unknown as Record<string, unknown>,
            organization: organization as unknown as Record<string, unknown>,
            organizationRequisite: await serializeOrganizationRequisiteForDocuments(
              ctx,
              organizationRequisite,
            ),
            format,
            lang,
          });
        await ctx.filesModule.files.commands.persistGeneratedCounterpartyFile({
          buffer: result.buffer,
          createdBy: c.get("user")?.id ?? null,
          fileName: result.fileName,
          fileSize: result.buffer.byteLength,
          generatedFormat: format,
          generatedLang: lang,
          linkKind: "legal_entity_contract",
          mimeType: result.mimeType,
          ownerId: counterpartyId,
        });

        c.header("Content-Type", result.mimeType);
        c.header(
          "Content-Disposition",
          `attachment; filename="${result.fileName}"`,
        );
        return c.body(result.buffer as unknown as ArrayBuffer);
      } catch (error) {
        return handleRouteError(c, error);
      }
    })
    .openapi(upsertLegalEntityContractRoute, async (c) => {
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
              {
                agentFee: input.agentFee,
                contractDate: input.contractDate,
                contractNumber: input.contractNumber,
                fixedFee: input.fixedFee,
                organizationId: input.organizationId,
                organizationRequisiteId: input.organizationRequisiteId,
              },
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
              agentFee: input.agentFee,
              contractDate: input.contractDate,
              contractNumber: input.contractNumber,
              customerId,
              fixedFee: input.fixedFee,
              organizationId: input.organizationId,
              organizationRequisiteId: input.organizationRequisiteId,
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
