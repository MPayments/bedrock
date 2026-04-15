import { cache } from "react";
import { headers } from "next/headers";
import { z } from "zod";

import { CurrencyOptionsResponseSchema } from "@bedrock/currencies/contracts";
import { RouteComposerLookupContextSchema } from "@bedrock/parties/contracts";

import { readJsonWithSchema, requestOk } from "@/lib/api/response";
import {
  FINANCE_DEAL_TYPE_VALUES,
  type FinanceDealType,
} from "@/features/treasury/deals/labels";
import {
  FINANCE_ROUTE_TEMPLATE_STATUS_VALUES,
  type FinanceRouteTemplateStatus,
} from "../labels";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3000";

const ApiDateTimeStringSchema = z.string().min(1);
const FinanceDealTypeSchema = z.enum(FINANCE_DEAL_TYPE_VALUES);
const FinanceRouteTemplateStatusSchema = z.enum(
  FINANCE_ROUTE_TEMPLATE_STATUS_VALUES,
);
const FinanceRouteTemplateBindingSchema = z.enum([
  "deal_applicant",
  "deal_beneficiary",
  "deal_customer",
  "deal_payer",
  "fixed_party",
]);
const FinanceRoutePartyKindSchema = z.enum([
  "counterparty",
  "customer",
  "organization",
]);
const FinanceRouteLegKindSchema = z.enum([
  "adjustment",
  "collection",
  "fx_conversion",
  "intercompany_funding",
  "intracompany_transfer",
  "payout",
  "return",
]);
const FinanceRouteComponentBasisTypeSchema = z.enum([
  "deal_source_amount",
  "deal_target_amount",
  "gross_revenue",
  "leg_from_amount",
  "leg_to_amount",
]);
const FinanceRouteComponentClassificationSchema = z.enum([
  "adjustment",
  "expense",
  "pass_through",
  "revenue",
]);
const FinanceRouteComponentFormulaTypeSchema = z.enum([
  "bps",
  "fixed",
  "manual",
  "per_million",
]);

async function fetchApi(path: string) {
  const requestHeaders = await headers();

  return fetch(`${API_URL}${path}`, {
    headers: {
      cookie: requestHeaders.get("cookie") ?? "",
      "x-bedrock-app-audience": "finance",
    },
    cache: "no-store",
  });
}

const FinanceRouteTemplateParticipantSchema = z.object({
  bindingKind: FinanceRouteTemplateBindingSchema,
  code: z.string(),
  displayNameTemplate: z.string().nullable(),
  id: z.string().uuid(),
  metadata: z.record(z.string(), z.unknown()),
  partyId: z.string().uuid().nullable(),
  partyKind: FinanceRoutePartyKindSchema,
  requisiteId: z.string().uuid().nullable(),
  role: z.string(),
  sequence: z.number().int().positive(),
});

const FinanceRouteTemplateLegSchema = z.object({
  code: z.string(),
  executionCounterpartyId: z.string().uuid().nullable(),
  expectedFromAmountMinor: z.string().nullable(),
  expectedRateDen: z.string().nullable(),
  expectedRateNum: z.string().nullable(),
  expectedToAmountMinor: z.string().nullable(),
  fromCurrencyId: z.string().uuid(),
  fromParticipantCode: z.string(),
  id: z.string().uuid(),
  idx: z.number().int().positive(),
  kind: FinanceRouteLegKindSchema,
  notes: z.string().nullable(),
  settlementModel: z.string(),
  toCurrencyId: z.string().uuid(),
  toParticipantCode: z.string(),
});

const FinanceRouteTemplateCostComponentSchema = z.object({
  basisType: FinanceRouteComponentBasisTypeSchema,
  bps: z.string().nullable(),
  classification: FinanceRouteComponentClassificationSchema,
  code: z.string(),
  currencyId: z.string().uuid(),
  family: z.string(),
  fixedAmountMinor: z.string().nullable(),
  formulaType: FinanceRouteComponentFormulaTypeSchema,
  id: z.string().uuid(),
  includedInClientRate: z.boolean(),
  legCode: z.string().nullable(),
  manualAmountMinor: z.string().nullable(),
  notes: z.string().nullable(),
  perMillion: z.string().nullable(),
  roundingMode: z.string(),
  sequence: z.number().int().positive(),
});

const FinanceRouteTemplateSummarySchema = z.object({
  code: z.string(),
  createdAt: ApiDateTimeStringSchema,
  dealType: FinanceDealTypeSchema,
  description: z.string().nullable(),
  id: z.string().uuid(),
  name: z.string(),
  status: FinanceRouteTemplateStatusSchema,
  updatedAt: ApiDateTimeStringSchema,
});

const FinanceRouteTemplateSchema = FinanceRouteTemplateSummarySchema.extend({
  costComponents: z.array(FinanceRouteTemplateCostComponentSchema),
  legs: z.array(FinanceRouteTemplateLegSchema),
  participants: z.array(FinanceRouteTemplateParticipantSchema),
});

const FinanceRouteTemplateWorkspaceSchema = z.object({
  currencies: CurrencyOptionsResponseSchema.shape.data,
  lookupContext: RouteComposerLookupContextSchema,
  template: FinanceRouteTemplateSchema.nullable(),
});

export type FinanceRouteTemplateParticipant = z.infer<
  typeof FinanceRouteTemplateParticipantSchema
>;
export type FinanceRouteTemplateLeg = z.infer<
  typeof FinanceRouteTemplateLegSchema
>;
export type FinanceRouteTemplateCostComponent = z.infer<
  typeof FinanceRouteTemplateCostComponentSchema
>;
export type FinanceRouteTemplateSummary = z.infer<
  typeof FinanceRouteTemplateSummarySchema
>;
export type FinanceRouteTemplate = z.infer<typeof FinanceRouteTemplateSchema>;
export type FinanceRouteTemplateWorkspace = z.infer<
  typeof FinanceRouteTemplateWorkspaceSchema
>;

const getFinanceRouteTemplateByIdUncached = async (
  id: string,
): Promise<FinanceRouteTemplate | null> => {
  if (!z.uuid({ version: "v4" }).safeParse(id).success) {
    return null;
  }

  const response = await fetchApi(
    `/v1/route-composer/templates/${encodeURIComponent(id)}`,
  );

  if (response.status === 404) {
    return null;
  }

  await requestOk(response, "Не удалось загрузить шаблон маршрута");
  return readJsonWithSchema(response, FinanceRouteTemplateSchema);
};

const getFinanceRouteTemplateWorkspaceByIdUncached = async (
  templateId: string,
): Promise<FinanceRouteTemplateWorkspace | null> => {
  const [lookupContextResponse, currenciesResponse] = await Promise.all([
    fetchApi("/v1/route-composer/lookup-context"),
    fetchApi("/v1/currencies/options"),
  ]);

  await requestOk(
    lookupContextResponse,
    "Не удалось загрузить контекст маршрутизатора",
  );
  await requestOk(currenciesResponse, "Не удалось загрузить валюты");

  const [lookupContext, currencies, template] = await Promise.all([
    readJsonWithSchema(lookupContextResponse, RouteComposerLookupContextSchema),
    readJsonWithSchema(currenciesResponse, CurrencyOptionsResponseSchema).then(
      (payload) => payload.data,
    ),
    templateId === "new"
      ? Promise.resolve(null)
      : getFinanceRouteTemplateByIdUncached(templateId),
  ]);

  if (templateId !== "new" && !template) {
    return null;
  }

  return FinanceRouteTemplateWorkspaceSchema.parse({
    currencies,
    lookupContext,
    template,
  });
};

const listFinanceRouteTemplatesUncached = async (input?: {
  dealType?: FinanceDealType;
  status?: FinanceRouteTemplateStatus[];
}): Promise<FinanceRouteTemplateSummary[]> => {
  const query = new URLSearchParams();

  if (input?.dealType) {
    query.set("dealType", input.dealType);
  }

  if (input?.status) {
    for (const status of input.status) {
      query.append("status", status);
    }
  }

  const search = query.toString();
  const response = await fetchApi(
    `/v1/route-composer/templates${search ? `?${search}` : ""}`,
  );

  await requestOk(response, "Не удалось загрузить шаблоны маршрутов");

  const templates = await readJsonWithSchema(
    response,
    z.array(FinanceRouteTemplateSummarySchema),
  );

  return [...templates].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
};

export const getFinanceRouteTemplateById = cache(
  getFinanceRouteTemplateByIdUncached,
);

export const getFinanceRouteTemplateWorkspaceById = cache(
  getFinanceRouteTemplateWorkspaceByIdUncached,
);

export async function listFinanceRouteTemplates(input?: {
  dealType?: FinanceDealType;
  status?: FinanceRouteTemplateStatus[];
}) {
  return listFinanceRouteTemplatesUncached(input);
}
