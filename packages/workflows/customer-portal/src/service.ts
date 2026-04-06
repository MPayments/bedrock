import {
  type CalculationsModule,
} from "@bedrock/calculations";
import type { CurrenciesService } from "@bedrock/currencies";
import type { DealsModule } from "@bedrock/deals";
import type {
  CreatePortalDealInput,
  Deal,
  DealDetails,
  DealIntakeDraft,
  PortalDealListProjection,
  PortalDealProjection,
} from "@bedrock/deals/contracts";
import {
  type CustomerMembershipsService,
  type IamService,
  type PortalAccessGrantsService,
  UserNotFoundError,
} from "@bedrock/iam";
import {
  projectLegacyPartyLegalEntity,
  projectLegacyRequisiteRouting,
  type PartiesModule,
} from "@bedrock/parties";
import type { Logger } from "@bedrock/platform/observability/logger";
import { isUuidLike, MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import { formatFractionDecimal } from "@bedrock/shared/money";

import {
  createCustomerBankingService,
  type BankProviderSearchResult,
} from "./bank-requisites";

interface LocalizedText {
  [key: string]: string | null | undefined;
  en?: string | null;
  ru?: string | null;
}

export interface CustomerPortalWorkflowDeps {
  calculations: Pick<CalculationsModule, "calculations">;
  currencies: Pick<CurrenciesService, "findByCode" | "findById">;
  deals: Pick<DealsModule, "deals">;
  iam: {
    customerMemberships: CustomerMembershipsService;
    portalAccessGrants: PortalAccessGrantsService;
    users: Pick<IamService, "queries">;
  };
  parties: Pick<PartiesModule, "counterparties" | "customers" | "requisites">;
  logger: Logger;
}

export interface CustomerContext {
  userId: string;
}

export interface CustomerPortalCreateLegalEntityInput {
  address?: string | null;
  addressI18n?: LocalizedText | null;
  bankMode: "existing" | "manual";
  bankProviderId?: string | null;
  bankProvider?: {
    address?: string | null;
    country?: string | null;
    name?: string | null;
    routingCode?: string | null;
  } | null;
  bankProviderI18n?: {
    address?: LocalizedText | null;
    name?: LocalizedText | null;
  } | null;
  bankRequisite?: {
    accountNo?: string | null;
    beneficiaryName?: string | null;
    corrAccount?: string | null;
    iban?: string | null;
  } | null;
  country?: string | null;
  directorBasis?: string | null;
  directorBasisI18n?: LocalizedText | null;
  directorName?: string | null;
  directorNameI18n?: LocalizedText | null;
  email?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  okpo?: string | null;
  oktmo?: string | null;
  orgName: string;
  orgNameI18n?: LocalizedText | null;
  orgType?: string | null;
  orgTypeI18n?: LocalizedText | null;
  phone?: string | null;
  position?: string | null;
  positionI18n?: LocalizedText | null;
  subAgentCounterpartyId?: string | null;
}

export class CustomerNotAuthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomerNotAuthorizedError";
  }
}

export interface CustomerPortalProfile {
  customers: Awaited<
    ReturnType<PartiesModule["customers"]["queries"]["findById"]>
  >[];
  hasOnboardingAccess: boolean;
  hasCrmAccess: boolean;
  hasCustomerPortalAccess: boolean;
  memberships: Awaited<
    ReturnType<CustomerMembershipsService["queries"]["listByUserId"]>
  >;
}

type CanonicalCalculation = Awaited<
  ReturnType<CalculationsModule["calculations"]["queries"]["findById"]>
>;
type CanonicalCounterparty = Awaited<
  ReturnType<PartiesModule["counterparties"]["queries"]["findById"]>
>;
type CanonicalCounterpartyListItem = NonNullable<Awaited<
  ReturnType<PartiesModule["counterparties"]["queries"]["findById"]>
>>;
type CustomerMembership = Awaited<
  ReturnType<CustomerMembershipsService["queries"]["listByUserId"]>
>[number];

interface PortalCalculationCurrencyMetadata {
  code: string;
  id: string;
  precision: number;
}

interface CustomerPortalCalculation {
  additionalExpenses: string;
  additionalExpensesCurrencyCode: string | null;
  additionalExpensesInBase: string;
  baseCurrencyCode: string;
  calculationTimestamp: string;
  createdAt: string;
  currencyCode: string;
  dealId: string | null;
  feeAmount: string;
  feeAmountInBase: string;
  feePercentage: string;
  fxQuoteId: string | null;
  id: string;
  originalAmount: string;
  rate: string;
  rateSource: string;
  sentToClient: number;
  status: "active" | "archived";
  totalAmount: string;
  totalInBase: string;
  totalWithExpensesInBase: string;
}

export interface CustomerPortalLegalEntity {
  address: string | null;
  counterpartyId: string;
  country: string | null;
  createdAt: string;
  directorName: string | null;
  externalId: string | null;
  fullName: string;
  inn: string | null;
  phone: string | null;
  relationshipKind: "customer_owned" | "external";
  shortName: string;
  updatedAt: string;
  email: string | null;
}

export interface CustomerPortalCustomerContext {
  createdAt: string;
  customerId: string;
  description: string | null;
  displayName: string;
  externalRef: string | null;
  legalEntities: CustomerPortalLegalEntity[];
  legalEntityCount: number;
  primaryCounterpartyId: string | null;
  updatedAt: string;
}

export interface CustomerPortalWorkflow {
  assertPortalAccess(ctx: CustomerContext): Promise<void>;
  assertOnboardingAccess(ctx: CustomerContext): Promise<CustomerPortalProfile>;
  createLegalEntity(
    ctx: CustomerContext,
    input: CustomerPortalCreateLegalEntityInput,
  ): Promise<{
    account: string | null;
    address: string | null;
    addressI18n: LocalizedText | null;
    bankAddress: string | null;
    bankAddressI18n: LocalizedText | null;
    bankCountry: string | null;
    bankName: string | null;
    bankNameI18n: LocalizedText | null;
    bic: string | null;
    corrAccount: string | null;
    counterpartyId: string;
    createdAt: string;
    customerId: string;
    directorBasis: string | null;
    directorBasisI18n: LocalizedText | null;
    directorName: string | null;
    directorNameI18n: LocalizedText | null;
    email: string | null;
    id: number;
    inn: string | null;
    isDeleted: boolean;
    kpp: string | null;
    ogrn: string | null;
    okpo: string | null;
    oktmo: string | null;
    orgName: string;
    orgNameI18n: LocalizedText | null;
    orgType: string | null;
    orgTypeI18n: LocalizedText | null;
    phone: string | null;
    position: string | null;
    positionI18n: LocalizedText | null;
    subAgentCounterpartyId: string | null;
    swift: string | null;
    updatedAt: string;
    userId: string | null;
  }>;
  searchBankProviders(
    ctx: CustomerContext,
    input: {
      limit?: number;
      query: string;
    },
  ): Promise<BankProviderSearchResult[]>;
  getProfile(ctx: CustomerContext): Promise<CustomerPortalProfile>;
  getCustomerContexts(ctx: CustomerContext): Promise<{
    data: CustomerPortalCustomerContext[];
    total: number;
  }>;
  createDealDraft(
    ctx: CustomerContext,
    input: CreatePortalDealInput,
    options: {
      idempotencyKey: string;
    },
  ): Promise<PortalDealProjection>;
  listMyDeals(
    ctx: CustomerContext,
    input?: { limit?: number; offset?: number },
  ): Promise<CustomerPortalDealListResponse>;
  listMyDealProjections(
    ctx: CustomerContext,
    input?: { limit?: number; offset?: number },
  ): Promise<PortalDealListProjection>;
  getDealById(
    ctx: CustomerContext,
    dealId: string,
  ): Promise<CustomerPortalDealDetailResponse>;
  getDealProjectionById(
    ctx: CustomerContext,
    dealId: string,
  ): Promise<PortalDealProjection>;
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCountryCode(value: string | null | undefined): string | null {
  const normalized = normalizeNullableText(value)?.toUpperCase() ?? null;
  return normalized && normalized.length === 2 ? normalized : null;
}

function toLocaleMap(
  value: LocalizedText | null | undefined,
): Record<string, string | null> | null {
  if (!value) {
    return null;
  }

  const entries = Object.entries(value).filter(
    ([, item]) => item !== undefined,
  ) as [string, string | null][];

  return Object.fromEntries(entries);
}

function buildCounterpartyLegalEntityBundle(
  input: CustomerPortalCreateLegalEntityInput,
) {
  const country = normalizeCountryCode(input.country ?? input.bankProvider?.country);
  const identifiers = [
    ["inn", normalizeNullableText(input.inn)],
    ["kpp", normalizeNullableText(input.kpp)],
    ["ogrn", normalizeNullableText(input.ogrn)],
    ["okpo", normalizeNullableText(input.okpo)],
    ["oktmo", normalizeNullableText(input.oktmo)],
  ]
    .filter(([, value]) => value)
    .map(([scheme, value]) => ({
      scheme: scheme!,
      value: value!,
      jurisdictionCode: null,
      issuer: null,
      isPrimary: true,
      validFrom: null,
      validTo: null,
    }));
  const contacts = [
    ["email", normalizeNullableText(input.email)],
    ["phone", normalizeNullableText(input.phone)],
  ]
    .filter(([, value]) => value)
    .map(([type, value]) => ({
      type: type!,
      label: null,
      value: value!,
      isPrimary: true,
    }));
  const addresses = normalizeNullableText(input.address)
    ? [
        {
          type: "legal",
          label: null,
          countryCode: country,
          jurisdictionCode: null,
          postalCode: null,
          city: null,
          line1: null,
          line2: null,
          rawText: normalizeNullableText(input.address),
          isPrimary: true,
        },
      ]
    : [];
  const representatives = normalizeNullableText(input.directorName)
    ? [
        {
          role: "director",
          fullName: normalizeNullableText(input.directorName)!,
          fullNameI18n: toLocaleMap(input.directorNameI18n),
          title: normalizeNullableText(input.position),
          titleI18n: toLocaleMap(input.positionI18n),
          basisDocument: normalizeNullableText(input.directorBasis),
          basisDocumentI18n: toLocaleMap(input.directorBasisI18n),
          isPrimary: true,
        },
      ]
    : [];

  return {
    profile: {
      fullName: input.orgName,
      shortName: input.orgName,
      fullNameI18n: null,
      shortNameI18n: toLocaleMap(input.orgNameI18n),
      legalFormCode: null,
      legalFormLabel: normalizeNullableText(input.orgType),
      legalFormLabelI18n: toLocaleMap(input.orgTypeI18n),
      countryCode: country,
      jurisdictionCode: null,
      registrationAuthority: null,
      registeredAt: null,
      businessActivityCode: null,
      businessActivityText: null,
      status: null,
    },
    identifiers,
    addresses,
    contacts,
    representatives,
    licenses: [],
  };
}

function canAccessCrm(role: string | null, banned: boolean | null): boolean {
  if (banned) {
    return false;
  }

  return role === "admin" || role === "agent";
}

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function resolvePortalCurrencyId(
  deps: CustomerPortalWorkflowDeps,
  value: string | null | undefined,
): Promise<string | null> {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return null;
  }

  if (isUuidLike(normalized)) {
    return normalized;
  }

  const currency = await deps.currencies.findByCode(normalized.toUpperCase());
  return currency.id;
}

function minorToDecimalString(amountMinor: bigint | string, precision: number) {
  const value = typeof amountMinor === "string" ? BigInt(amountMinor) : amountMinor;
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const digits = absolute.toString();

  if (precision === 0) {
    return `${negative ? "-" : ""}${digits}`;
  }

  const padded = digits.padStart(precision + 1, "0");
  const integerPart = padded.slice(0, padded.length - precision);
  const fractionPart = padded.slice(padded.length - precision);

  return `${negative ? "-" : ""}${integerPart}.${fractionPart}`;
}

function feeBpsToPercentString(feeBps: bigint | string) {
  return minorToDecimalString(feeBps, 2);
}

function rationalToDecimalString(
  numerator: bigint | string,
  denominator: bigint | string,
  scale = 6,
) {
  return formatFractionDecimal(numerator, denominator, {
    scale,
    trimTrailingZeros: true,
  });
}

function serializeRateSource(rateSource: string) {
  return rateSource === "cbr" ? "cbru" : rateSource;
}

async function buildCalculationCurrencyMetadata(
  deps: CustomerPortalWorkflowDeps,
  currencyIds: string[],
) {
  const uniqueIds = Array.from(new Set(currencyIds.filter(Boolean)));
  const entries = await Promise.all(
    uniqueIds.map(async (currencyId) => {
      const currency = await deps.currencies.findById(currencyId);
      return [
        currencyId,
        {
          id: currency.id,
          code: currency.code,
          precision: currency.precision,
        } satisfies PortalCalculationCurrencyMetadata,
      ] as const;
    }),
  );

  return new Map(entries);
}

async function serializePortalCalculationForDeal(
  deps: CustomerPortalWorkflowDeps,
  calculation: CanonicalCalculation | null,
): Promise<CustomerPortalCalculation | null> {
  if (!calculation) {
    return null;
  }

  const currencyMetadata = await buildCalculationCurrencyMetadata(
    deps,
    [
      calculation.currentSnapshot.calculationCurrencyId,
      calculation.currentSnapshot.baseCurrencyId,
      calculation.currentSnapshot.additionalExpensesCurrencyId ?? "",
    ],
  );

  const snapshot = calculation.currentSnapshot;
  const calculationCurrency = currencyMetadata.get(snapshot.calculationCurrencyId);
  const baseCurrency = currencyMetadata.get(snapshot.baseCurrencyId);
  const additionalExpensesCurrency = snapshot.additionalExpensesCurrencyId
    ? currencyMetadata.get(snapshot.additionalExpensesCurrencyId) ?? null
    : null;

  if (!calculationCurrency || !baseCurrency) {
    throw new Error("Missing currency metadata for portal calculation");
  }

  return {
    id: calculation.id,
    dealId: null,
    currencyCode: calculationCurrency.code,
    originalAmount: minorToDecimalString(
      snapshot.originalAmountMinor,
      calculationCurrency.precision,
    ),
    feePercentage: feeBpsToPercentString(snapshot.feeBps),
    feeAmount: minorToDecimalString(
      snapshot.feeAmountMinor,
      calculationCurrency.precision,
    ),
    totalAmount: minorToDecimalString(
      snapshot.totalAmountMinor,
      calculationCurrency.precision,
    ),
    rateSource: serializeRateSource(snapshot.rateSource),
    rate: rationalToDecimalString(snapshot.rateNum, snapshot.rateDen),
    additionalExpensesCurrencyCode: additionalExpensesCurrency?.code ?? null,
    additionalExpenses: minorToDecimalString(
      snapshot.additionalExpensesAmountMinor,
      additionalExpensesCurrency?.precision ?? baseCurrency.precision,
    ),
    baseCurrencyCode: baseCurrency.code,
    feeAmountInBase: minorToDecimalString(
      snapshot.feeAmountInBaseMinor,
      baseCurrency.precision,
    ),
    totalInBase: minorToDecimalString(
      snapshot.totalInBaseMinor,
      baseCurrency.precision,
    ),
    additionalExpensesInBase: minorToDecimalString(
      snapshot.additionalExpensesInBaseMinor,
      baseCurrency.precision,
    ),
    totalWithExpensesInBase: minorToDecimalString(
      snapshot.totalWithExpensesInBaseMinor,
      baseCurrency.precision,
    ),
    calculationTimestamp: snapshot.calculationTimestamp.toISOString(),
    sentToClient: 0,
    status: calculation.isActive ? "active" : "archived",
    fxQuoteId: snapshot.fxQuoteId,
    createdAt: calculation.createdAt.toISOString(),
  };
}

function mapPortalDealStatus(status: Deal["status"]): Deal["status"] {
  return status;
}

function createEmptyPortalDealIntakeDraft(
  type: CreatePortalDealInput["type"],
): DealIntakeDraft {
  return {
    type,
    common: {
      applicantCounterpartyId: null,
      customerNote: null,
      requestedExecutionDate: null,
    },
    externalBeneficiary: {
      bankInstructionSnapshot: null,
      beneficiaryCounterpartyId: null,
      beneficiarySnapshot: null,
    },
    incomingReceipt: {
      contractNumber: null,
      expectedAmount: null,
      expectedAt: null,
      expectedCurrencyId: null,
      invoiceNumber: null,
      payerCounterpartyId: null,
      payerSnapshot: null,
    },
    moneyRequest: {
      purpose: null,
      sourceAmount: null,
      sourceCurrencyId: null,
      targetCurrencyId: null,
    },
    settlementDestination: {
      bankInstructionSnapshot: null,
      mode: null,
      requisiteId: null,
    },
  };
}

function buildPortalDealIntakeDraft(
  input: CreatePortalDealInput,
): DealIntakeDraft {
  const intake = createEmptyPortalDealIntakeDraft(input.type);

  intake.common = {
    applicantCounterpartyId: input.common.applicantCounterpartyId,
    customerNote: input.common.customerNote ?? null,
    requestedExecutionDate: input.common.requestedExecutionDate ?? null,
  };
  intake.moneyRequest = {
    purpose: input.moneyRequest.purpose ?? null,
    sourceAmount: input.moneyRequest.sourceAmount ?? null,
    sourceCurrencyId: input.moneyRequest.sourceCurrencyId ?? null,
    targetCurrencyId: input.moneyRequest.targetCurrencyId ?? null,
  };

  if (input.incomingReceipt) {
    intake.incomingReceipt = {
      contractNumber: input.incomingReceipt.contractNumber ?? null,
      expectedAmount: input.incomingReceipt.expectedAmount ?? null,
      expectedAt: input.incomingReceipt.expectedAt ?? null,
      expectedCurrencyId: input.incomingReceipt.expectedCurrencyId ?? null,
      invoiceNumber: input.incomingReceipt.invoiceNumber ?? null,
      payerCounterpartyId: null,
      payerSnapshot: null,
    };
  }

  return intake;
}

interface CustomerPortalDealListItem {
  amount: string | null;
  calculation: Awaited<ReturnType<typeof serializePortalCalculationForDeal>>;
  counterpartyId: string | null;
  createdAt: string;
  currencyCode: string | null;
  id: string;
  organizationName: string | null;
  status: Deal["status"];
}

interface CustomerPortalDealListResponse {
  data: CustomerPortalDealListItem[];
  limit: number;
  offset: number;
  total: number;
}

interface CustomerPortalDealDetailResponse {
  calculation: Awaited<ReturnType<typeof serializePortalCalculationForDeal>>;
  deal: DealDetails;
  organizationName: string | null;
}

function mapLegalEntity(
  counterparty: CanonicalCounterpartyListItem,
): CustomerPortalLegalEntity {
  const legal = projectLegacyPartyLegalEntity(counterparty);

  return {
    address: legal.address,
    counterpartyId: counterparty.id,
    country: counterparty.country ?? null,
    createdAt: serializeDate(counterparty.createdAt),
    directorName: legal.directorName,
    email: legal.email,
    externalId: counterparty.externalId,
    fullName: counterparty.fullName,
    inn: legal.inn ?? counterparty.externalId ?? null,
    phone: legal.phone,
    relationshipKind: counterparty.relationshipKind,
    shortName: counterparty.shortName,
    updatedAt: serializeDate(counterparty.updatedAt),
  };
}

export function createCustomerPortalWorkflow(
  deps: CustomerPortalWorkflowDeps,
): CustomerPortalWorkflow {
  const customerBankingService = createCustomerBankingService({
    currencies: deps.currencies,
    logger: deps.logger,
    requisites: deps.parties.requisites,
  });

  async function listMembershipsByUserId(userId: string) {
    return deps.iam.customerMemberships.queries.listByUserId({ userId });
  }

  async function listActiveMembershipsByUserId(userId: string) {
    const memberships = await listMembershipsByUserId(userId);
    return memberships.filter(
      (membership: CustomerMembership) => membership.status === "active",
    );
  }

  async function listAuthorizedCustomerIds(userId: string) {
    const memberships = await listActiveMembershipsByUserId(userId);
    return Array.from(
      new Set<string>(
        memberships.map((membership: CustomerMembership) => membership.customerId),
      ),
    );
  }

  async function getCrmAccess(userId: string) {
    try {
      const user = await deps.iam.users.queries.findById(userId);
      return canAccessCrm(user.role, user.banned);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return false;
      }

      throw error;
    }
  }

  async function ensureActiveOwnerMembership(input: {
    customerId: string;
    userId: string;
  }) {
    return deps.iam.customerMemberships.commands.upsert({
      customerId: input.customerId,
      role: "owner",
      status: "active",
      userId: input.userId,
    });
  }

  async function listCustomerOwnedCounterpartiesByCustomerId(
    customerIds: string[],
  ) {
    const uniqueCustomerIds = Array.from(new Set(customerIds));
    const rows = await Promise.all(
      uniqueCustomerIds.map(async (customerId) => {
        const result = await deps.parties.counterparties.queries.list({
          customerId,
          relationshipKind: ["customer_owned"],
          limit: MAX_QUERY_LIST_LIMIT,
          offset: 0,
          sortBy: "createdAt",
          sortOrder: "desc",
        });
        const counterparties = (
          await Promise.all(
            result.data.map((item) =>
              deps.parties.counterparties.queries.findById(item.id),
            ),
          )
        ).filter(
          (item): item is CanonicalCounterpartyListItem => item !== null,
        );

        return [customerId, counterparties] as const;
      }),
    );

    return new Map<string, CanonicalCounterpartyListItem[]>(rows);
  }

  async function ensureCustomerOwnedCounterpartyRecord(
    counterpartyId: string,
  ): Promise<CanonicalCounterparty> {
    const counterparty =
      await deps.parties.counterparties.queries.findById(counterpartyId);
    if (
      !counterparty ||
      !counterparty.customerId ||
      counterparty.relationshipKind !== "customer_owned"
    ) {
      throw new CustomerNotAuthorizedError(
        `Counterparty ${counterpartyId} is not a customer-owned legal entity`,
      );
    }

    return counterparty;
  }

  async function getCustomerContextsByUserId(
    userId: string,
  ): Promise<CustomerPortalCustomerContext[]> {
    const customerIds = await listAuthorizedCustomerIds(userId);
    if (customerIds.length === 0) {
      return [];
    }

    const customers = await deps.parties.customers.queries.listByIds(customerIds);
    const counterpartiesByCustomerId =
      await listCustomerOwnedCounterpartiesByCustomerId(customerIds);

    return customers
      .map((customer) => {
        const legalEntities = (
          counterpartiesByCustomerId.get(customer.id) ?? []
        ).map((counterparty) => mapLegalEntity(counterparty));

        return {
          createdAt: serializeDate(customer.createdAt),
          customerId: customer.id,
          description: customer.description,
          displayName: customer.displayName,
          externalRef: customer.externalRef,
          legalEntities,
          legalEntityCount: legalEntities.length,
          primaryCounterpartyId: legalEntities[0]?.counterpartyId ?? null,
          updatedAt: serializeDate(customer.updatedAt),
        } satisfies CustomerPortalCustomerContext;
      })
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
  }

  async function assertCounterpartyOwnership(
    userId: string,
    counterpartyId: string,
  ): Promise<CanonicalCounterparty> {
    const counterparty =
      await ensureCustomerOwnedCounterpartyRecord(counterpartyId);

    const hasMembership =
      await deps.iam.customerMemberships.queries.hasMembership({
        customerId: counterparty.customerId!,
        userId,
      });
    if (!hasMembership) {
      throw new CustomerNotAuthorizedError(
        `Counterparty ${counterpartyId} not found or not owned by user ${userId}`,
      );
    }

    return counterparty;
  }

  async function assertDealOwnership(
    userId: string,
    deal: Deal,
  ): Promise<void> {
    const hasMembership =
      await deps.iam.customerMemberships.queries.hasMembership({
        customerId: deal.customerId,
        userId,
      });

    if (!hasMembership) {
      throw new CustomerNotAuthorizedError(
        `Deal ${deal.id} not found or not owned by user ${userId}`,
      );
    }
  }

  async function listPortalDealsForCustomerIds(
    customerIds: string[],
  ): Promise<Deal[]> {
    const uniqueCustomerIds = Array.from(new Set(customerIds));
    const results = await Promise.all(
      uniqueCustomerIds.map((customerId) =>
        deps.deals.deals.queries.list({
          customerId,
          limit: MAX_QUERY_LIST_LIMIT,
          offset: 0,
          sortBy: "createdAt",
          sortOrder: "desc",
        }),
      ),
    );

    return results.flatMap((result) => result.data);
  }

  async function findPortalCounterpartyName(
    deal: DealDetails,
  ): Promise<{ counterpartyId: string | null; organizationName: string | null }> {
    const counterpartyParticipant =
      deal.participants.find((participant) => participant.role === "counterparty") ??
      null;

    if (!counterpartyParticipant?.counterpartyId) {
      return {
        counterpartyId: null,
        organizationName: null,
      };
    }

    const counterparty = await deps.parties.counterparties.queries.findById(
      counterpartyParticipant.counterpartyId,
    );

    return {
      counterpartyId: counterpartyParticipant.counterpartyId,
      organizationName: counterparty?.shortName ?? counterparty?.fullName ?? null,
    };
  }

  async function serializePortalDealListItem(
    deal: Deal,
  ): Promise<CustomerPortalDealListItem> {
    const [dealDetails, currency, calculation] = await Promise.all([
      deps.deals.deals.queries.findById(deal.id),
      deal.currencyId
        ? deps.currencies.findById(deal.currencyId)
        : Promise.resolve(null),
      deal.calculationId
        ? deps.calculations.calculations.queries.findById(deal.calculationId)
        : Promise.resolve(null),
    ]);

    const {
      counterpartyId,
      organizationName,
    } = dealDetails
      ? await findPortalCounterpartyName(dealDetails)
      : { counterpartyId: null, organizationName: null };

    return {
      amount: deal.amount,
      calculation: await serializePortalCalculationForDeal(
        deps,
        calculation,
      ),
      counterpartyId,
      createdAt: deal.createdAt.toISOString(),
      currencyCode: currency?.code ?? null,
      id: deal.id,
      organizationName,
      status: mapPortalDealStatus(deal.status),
    };
  }

  async function getProfile(ctx: CustomerContext): Promise<CustomerPortalProfile> {
    const memberships = await listMembershipsByUserId(ctx.userId);
    const activeMemberships = memberships.filter(
      (membership: CustomerMembership) => membership.status === "active",
    );
    const customerIds = Array.from(
      new Set<string>(
        activeMemberships.map(
          (membership: CustomerMembership) => membership.customerId,
        ),
      ),
    );
    const customers = await deps.parties.customers.queries.listByIds(customerIds);
    const hasCrmAccess = await getCrmAccess(ctx.userId);
    const hasOnboardingAccess =
      customerIds.length > 0 ||
      (await deps.iam.portalAccessGrants.queries.hasPendingGrant({
        userId: ctx.userId,
      }));

    return {
      customers,
      hasOnboardingAccess,
      hasCrmAccess,
      hasCustomerPortalAccess: customerIds.length > 0,
      memberships,
    };
  }

  async function assertPortalAccess(ctx: CustomerContext): Promise<void> {
    const profile = await getProfile(ctx);
    if (!profile.hasCustomerPortalAccess) {
      throw new CustomerNotAuthorizedError(
        `User ${ctx.userId} does not have customer portal access`,
      );
    }
  }

  async function assertOnboardingAccess(
    ctx: CustomerContext,
  ): Promise<CustomerPortalProfile> {
    const profile = await getProfile(ctx);
    if (!profile.hasOnboardingAccess) {
      throw new CustomerNotAuthorizedError(
        `User ${ctx.userId} does not have portal onboarding access`,
      );
    }

    return profile;
  }

  return {
    assertPortalAccess,
    assertOnboardingAccess,

    async createLegalEntity(
      ctx: CustomerContext,
      input: CustomerPortalCreateLegalEntityInput,
    ) {
      await assertOnboardingAccess(ctx);

      const customer = await deps.parties.customers.commands.create({
        description: null,
        displayName: input.orgName,
        externalRef: null,
      });
      const legalEntityBundle = buildCounterpartyLegalEntityBundle(input);
      const counterparty =
        await deps.parties.counterparties.commands.create({
          customerId: customer.id,
          description: null,
          externalId: normalizeNullableText(input.inn),
          kind: "legal_entity",
          legalEntity: legalEntityBundle,
          relationshipKind: "customer_owned",
        });

      await ensureActiveOwnerMembership({
        customerId: customer.id,
        userId: ctx.userId,
      });
      await deps.iam.portalAccessGrants.commands.consume({
        userId: ctx.userId,
      });

      deps.logger.info("Customer created legal entity", {
        counterpartyId: counterparty.id,
        customerId: customer.id,
        userId: ctx.userId,
      });

      const { provider, requisite } =
        await customerBankingService.upsertCounterpartyBankRequisite({
          counterpartyId: counterparty.id,
          values: input,
        });
      const legal = projectLegacyPartyLegalEntity(counterparty);
      const routing = projectLegacyRequisiteRouting({
        provider,
        requisite,
      });

      return {
        account: routing.accountNo,
        address: legal.address,
        addressI18n: legal.addressI18n,
        bankAddress: routing.bankAddress,
        bankAddressI18n: input.bankProviderI18n?.address ?? null,
        bankCountry: provider?.country ?? null,
        bankName: routing.bankName,
        bankNameI18n: input.bankProviderI18n?.name ?? null,
        bic: routing.bic,
        corrAccount: routing.corrAccount,
        counterpartyId: counterparty.id,
        createdAt: counterparty.createdAt.toISOString(),
        customerId: customer.id,
        directorBasis: legal.directorBasis,
        directorBasisI18n: legal.directorBasisI18n,
        directorName: legal.directorName,
        directorNameI18n: legal.directorNameI18n,
        email: legal.email,
        id: 0,
        inn: legal.inn,
        isDeleted: false,
        kpp: legal.kpp,
        ogrn: legal.ogrn,
        okpo: legal.okpo,
        oktmo: legal.oktmo,
        orgName: counterparty.shortName,
        orgNameI18n: legal.orgNameI18n,
        orgType: legal.orgType,
        orgTypeI18n: legal.orgTypeI18n,
        phone: legal.phone,
        position: legal.position,
        positionI18n: legal.positionI18n,
        subAgentCounterpartyId: normalizeNullableText(
          input.subAgentCounterpartyId,
        ),
        swift: routing.swift,
        updatedAt: counterparty.updatedAt.toISOString(),
        userId: null,
      };
    },

    async searchBankProviders(ctx: CustomerContext, input) {
      await assertOnboardingAccess(ctx);
      return customerBankingService.searchBankProviders(input);
    },

    getProfile,

    async getCustomerContexts(ctx: CustomerContext) {
      const data = await getCustomerContextsByUserId(ctx.userId);
      return {
        data,
        total: data.length,
      };
    },

    async createDealDraft(
      ctx: CustomerContext,
      input: CreatePortalDealInput,
      options: {
        idempotencyKey: string;
      },
    ) {
      const applicant = await assertCounterpartyOwnership(
        ctx.userId,
        input.common.applicantCounterpartyId,
      );

      if (!applicant.customerId) {
        throw new CustomerNotAuthorizedError(
          `Counterparty ${applicant.id} is not linked to a customer`,
        );
      }

      const [
        sourceCurrencyId,
        targetCurrencyId,
        expectedCurrencyId,
      ] = await Promise.all([
        resolvePortalCurrencyId(deps, input.moneyRequest.sourceCurrencyId),
        resolvePortalCurrencyId(deps, input.moneyRequest.targetCurrencyId),
        resolvePortalCurrencyId(deps, input.incomingReceipt?.expectedCurrencyId),
      ]);

      const normalizedInput: CreatePortalDealInput = {
        ...input,
        incomingReceipt: input.incomingReceipt
          ? {
              ...input.incomingReceipt,
              expectedCurrencyId,
            }
          : input.incomingReceipt,
        moneyRequest: {
          ...input.moneyRequest,
          sourceCurrencyId,
          targetCurrencyId,
        },
      };

      const created = await deps.deals.deals.commands.createDraft({
        actorUserId: ctx.userId,
        customerId: applicant.customerId,
        idempotencyKey: options.idempotencyKey,
        intake: buildPortalDealIntakeDraft(normalizedInput),
      });

      deps.logger.info("Customer created typed deal draft", {
        applicantCounterpartyId: applicant.id,
        dealId: created.summary.id,
        type: input.type,
        userId: ctx.userId,
      });

      const projection = await deps.deals.deals.queries.findPortalById(
        created.summary.id,
      );

      if (!projection) {
        throw new CustomerNotAuthorizedError(
          `Deal ${created.summary.id} not found`,
        );
      }

      return projection;
    },

    async listMyDeals(
      ctx: CustomerContext,
      input?: { limit?: number; offset?: number },
    ): Promise<CustomerPortalDealListResponse> {
      const customerIds = await listAuthorizedCustomerIds(ctx.userId);

      if (customerIds.length === 0) {
        return {
          data: [],
          total: 0,
          limit: input?.limit ?? 20,
          offset: input?.offset ?? 0,
        };
      }

      const allDeals = await listPortalDealsForCustomerIds(customerIds);

      allDeals.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;
      const pagedDeals = allDeals.slice(offset, offset + limit);

      return {
        data: await Promise.all(
          pagedDeals.map((deal) => serializePortalDealListItem(deal)),
        ),
        total: allDeals.length,
        limit,
        offset,
      };
    },

    async listMyDealProjections(
      ctx: CustomerContext,
      input?: { limit?: number; offset?: number },
    ): Promise<PortalDealListProjection> {
      const customerIds = await listAuthorizedCustomerIds(ctx.userId);

      if (customerIds.length === 0) {
        return {
          data: [],
          total: 0,
          limit: input?.limit ?? 20,
          offset: input?.offset ?? 0,
        };
      }

      const uniqueCustomerIds = Array.from(new Set(customerIds));
      const results = await Promise.all(
        uniqueCustomerIds.map((customerId) =>
          deps.deals.deals.queries.listPortalDeals({
            customerId,
            limit: MAX_QUERY_LIST_LIMIT,
            offset: 0,
          }),
        ),
      );

      const allDeals = results.flatMap((result) => result.data);
      allDeals.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const limit = input?.limit ?? 20;
      const offset = input?.offset ?? 0;

      return {
        data: allDeals.slice(offset, offset + limit),
        total: allDeals.length,
        limit,
        offset,
      };
    },

    async getDealById(
      ctx: CustomerContext,
      dealId: string,
    ): Promise<CustomerPortalDealDetailResponse> {
      const detail = await deps.deals.deals.queries.findById(dealId);

      if (!detail) {
        throw new CustomerNotAuthorizedError(`Deal ${dealId} not found`);
      }

      await assertDealOwnership(ctx.userId, detail);

      const [calculation, { organizationName }] = await Promise.all([
        detail.calculationId
          ? deps.calculations.calculations.queries.findById(detail.calculationId)
          : Promise.resolve(null),
        findPortalCounterpartyName(detail),
      ]);

      return {
        calculation: await serializePortalCalculationForDeal(
          deps,
          calculation,
        ),
        deal: detail,
        organizationName,
      };
    },

    async getDealProjectionById(
      ctx: CustomerContext,
      dealId: string,
    ): Promise<PortalDealProjection> {
      const detail = await deps.deals.deals.queries.findById(dealId);

      if (!detail) {
        throw new CustomerNotAuthorizedError(`Deal ${dealId} not found`);
      }

      await assertDealOwnership(ctx.userId, detail);

      const projection = await deps.deals.deals.queries.findPortalById(dealId);
      if (!projection) {
        throw new CustomerNotAuthorizedError(`Deal ${dealId} not found`);
      }

      return projection;
    },
  };
}
