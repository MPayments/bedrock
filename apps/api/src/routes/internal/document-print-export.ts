import {
  findPartyAddress,
  findPartyIdentifier,
  findPartyRepresentative,
  findRequisiteIdentifier,
  findRequisiteProviderIdentifier,
  formatPartyAddress,
  resolveRequisiteProviderDisplayName,
} from "@bedrock/parties";
import type {
  Counterparty,
  Organization,
  Requisite,
  RequisiteProvider,
} from "@bedrock/parties/contracts";
import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";
import { minorToAmountString } from "@bedrock/shared/money";
import type {
  ClientContractFormat,
  DocumentLanguage,
  GeneratedDocument,
} from "@bedrock/workflow-document-generation";

import type { AppContext } from "../../context";

const PRINTABLE_DEAL_DOCUMENT_TYPES = new Set([
  "acceptance",
  "application",
  "invoice",
]);

type LocalizedText = {
  en?: string | null;
  ru?: string | null;
};

function toLocalizedText(
  value: Record<string, string | null> | null | undefined,
  fallback?: string | null,
): LocalizedText | null {
  const ru = value?.ru ?? fallback ?? null;
  const en = value?.en ?? fallback ?? null;

  return ru || en ? { en, ru } : null;
}

function formatIsoDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function mapCounterpartyForTemplate(counterparty: Counterparty) {
  const profile = counterparty.partyProfile?.profile ?? null;
  const representative = findPartyRepresentative(counterparty);
  const address = findPartyAddress(counterparty);

  return {
    id: counterparty.id,
    orgName: profile?.fullName ?? counterparty.fullName,
    orgNameI18n: toLocalizedText(
      profile?.fullNameI18n,
      profile?.fullName ?? counterparty.fullName,
    ),
    orgType: profile?.legalFormLabel ?? null,
    orgTypeI18n: toLocalizedText(profile?.legalFormLabelI18n),
    directorName: representative?.fullName ?? null,
    directorNameI18n: toLocalizedText(representative?.fullNameI18n),
    directorBasis: representative?.basisDocument ?? null,
    directorBasisI18n: toLocalizedText(representative?.basisDocumentI18n),
    address: formatPartyAddress(address),
    addressI18n: toLocalizedText(address?.fullAddressI18n, address?.fullAddress),
    inn:
      findPartyIdentifier(counterparty, "inn")?.value ??
      counterparty.externalRef ??
      null,
    kpp: findPartyIdentifier(counterparty, "kpp")?.value ?? null,
    ogrn: findPartyIdentifier(counterparty, "ogrn")?.value ?? null,
  };
}

function mapOrganizationForTemplate(organization: Organization) {
  const profile = organization.partyProfile?.profile ?? null;
  const representative = findPartyRepresentative(organization);
  const address = findPartyAddress(organization);

  return {
    id: organization.id,
    name: profile?.shortName ?? organization.shortName,
    nameI18n: toLocalizedText(
      profile?.shortNameI18n,
      profile?.shortName ?? organization.shortName,
    ),
    address: formatPartyAddress(address),
    addressI18n: toLocalizedText(address?.fullAddressI18n, address?.fullAddress),
    country: organization.country,
    city: address?.city ?? null,
    cityI18n: toLocalizedText(address?.cityI18n, address?.city),
    directorName: representative?.fullName ?? null,
    directorNameI18n: toLocalizedText(representative?.fullNameI18n),
    inn:
      findPartyIdentifier(organization, "inn")?.value ??
      organization.externalRef ??
      null,
    taxId: findPartyIdentifier(organization, "tax_id")?.value ?? null,
    kpp: findPartyIdentifier(organization, "kpp")?.value ?? null,
    signatureKey: organization.signatureKey ?? null,
    sealKey: organization.sealKey ?? null,
  };
}

function mapOrganizationRequisiteForTemplate(input: {
  currencyCode: string;
  provider: RequisiteProvider | null;
  requisite: Requisite;
}) {
  const { currencyCode, provider, requisite } = input;

  return {
    id: requisite.id,
    accountNo:
      findRequisiteIdentifier(requisite, "local_account_number")?.value ?? null,
    bic:
      findRequisiteProviderIdentifier({
        branchId: requisite.providerBranchId,
        provider,
        scheme: "bic",
      })?.value ?? null,
    corrAccount:
      findRequisiteProviderIdentifier({
        branchId: requisite.providerBranchId,
        provider,
        scheme: "corr_account",
      })?.value ?? null,
    currencyCode,
    institutionName:
      resolveRequisiteProviderDisplayName({
        branchId: requisite.providerBranchId,
        provider,
      }) ?? null,
    ownerId: requisite.ownerId,
    swift:
      findRequisiteProviderIdentifier({
        branchId: requisite.providerBranchId,
        provider,
        scheme: "swift",
      })?.value ?? null,
  };
}

function readPayloadString(
  payload: unknown,
  key: string,
): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

async function buildCalculationTemplateData(input: {
  ctx: AppContext;
  calculationId: string | null;
  fallbackAmount: string | null;
  fallbackCurrency: string | null;
}) {
  if (!input.calculationId) {
    return {
      baseCurrencyCode: input.fallbackCurrency ?? "RUB",
      currencyCode: input.fallbackCurrency ?? "RUB",
      totalAmount: input.fallbackAmount ?? "0",
    };
  }

  const calculation =
    await input.ctx.calculationsModule.calculations.queries.findById(
      input.calculationId,
    );
  const snapshot = calculation?.currentSnapshot;

  if (!snapshot) {
    return {
      baseCurrencyCode: input.fallbackCurrency ?? "RUB",
      currencyCode: input.fallbackCurrency ?? "RUB",
      totalAmount: input.fallbackAmount ?? "0",
    };
  }

  const [calculationCurrency, baseCurrency, fixedFeeCurrency] =
    await Promise.all([
      input.ctx.currenciesService.findById(snapshot.calculationCurrencyId),
      input.ctx.currenciesService.findById(snapshot.baseCurrencyId),
      snapshot.fixedFeeCurrencyId
        ? input.ctx.currenciesService.findById(snapshot.fixedFeeCurrencyId)
        : Promise.resolve(null),
    ]);

  return {
    additionalExpenses: minorToAmountString(
      snapshot.additionalExpensesAmountMinor,
      { currency: calculationCurrency.code },
    ),
    additionalExpensesInBase: minorToAmountString(
      snapshot.additionalExpensesInBaseMinor,
      { currency: baseCurrency.code },
    ),
    agreementFeeAmount: minorToAmountString(snapshot.agreementFeeAmountMinor, {
      currency: calculationCurrency.code,
    }),
    agreementFeePercentage: snapshot.agreementFeeBps,
    baseCurrencyCode: baseCurrency.code,
    calculationTimestamp: snapshot.calculationTimestamp,
    currencyCode: calculationCurrency.code,
    fixedFeeAmount: minorToAmountString(snapshot.fixedFeeAmountMinor, {
      currency: fixedFeeCurrency?.code ?? calculationCurrency.code,
    }),
    fixedFeeCurrencyCode: fixedFeeCurrency?.code ?? null,
    finalRate: `${snapshot.rateNum}/${snapshot.rateDen}`,
    id: calculation.id,
    originalAmount: minorToAmountString(snapshot.originalAmountMinor, {
      currency: calculationCurrency.code,
    }),
    quoteMarkupAmount: minorToAmountString(snapshot.quoteMarkupAmountMinor, {
      currency: calculationCurrency.code,
    }),
    quoteMarkupPercentage: snapshot.quoteMarkupBps,
    rate: `${snapshot.rateNum}/${snapshot.rateDen}`,
    totalAmount: minorToAmountString(snapshot.totalAmountMinor, {
      currency: calculationCurrency.code,
    }),
    totalFeeAmount: minorToAmountString(snapshot.totalFeeAmountMinor, {
      currency: calculationCurrency.code,
    }),
    totalFeeAmountInBase: minorToAmountString(
      snapshot.totalFeeAmountInBaseMinor,
      { currency: baseCurrency.code },
    ),
    totalFeePercentage: snapshot.totalFeeBps,
    totalInBase: minorToAmountString(snapshot.totalInBaseMinor, {
      currency: baseCurrency.code,
    }),
    totalWithExpensesInBase: minorToAmountString(
      snapshot.totalWithExpensesInBaseMinor,
      { currency: baseCurrency.code },
    ),
  };
}

export async function exportPrintableDocument(input: {
  actorUserId: string;
  ctx: AppContext;
  docType: string;
  documentId: string;
  format: ClientContractFormat;
  lang: DocumentLanguage;
}): Promise<GeneratedDocument> {
  if (!PRINTABLE_DEAL_DOCUMENT_TYPES.has(input.docType)) {
    throw new ValidationError(
      `Printable form is not configured for document type ${input.docType}`,
    );
  }

  const result = await input.ctx.documentsService.get(
    input.docType,
    input.documentId,
    input.actorUserId,
  );
  const { document } = result;

  if (!result.dealId) {
    throw new ValidationError(
      `Document ${document.id} is not linked to a deal`,
    );
  }

  const deal = await input.ctx.dealsModule.deals.queries.findById(result.dealId);
  if (!deal) {
    throw new NotFoundError("Deal", result.dealId);
  }

  const agreement =
    await input.ctx.agreementsModule.agreements.queries.findById(
      deal.agreementId,
    );
  if (!agreement) {
    throw new NotFoundError("Agreement", deal.agreementId);
  }

  const counterpartyId =
    document.counterpartyId ?? readPayloadString(document.payload, "counterpartyId");
  if (!counterpartyId) {
    throw new ValidationError(`Document ${document.id} has no counterparty`);
  }

  const organizationId =
    readPayloadString(document.payload, "organizationId") ??
    agreement.organizationId;
  const organizationRequisiteId =
    document.organizationRequisiteId ??
    readPayloadString(document.payload, "organizationRequisiteId") ??
    agreement.organizationRequisiteId;

  const [counterparty, organization, organizationRequisite] =
    await Promise.all([
      input.ctx.partiesModule.counterparties.queries.findById(counterpartyId),
      input.ctx.partiesModule.organizations.queries.findById(organizationId),
      input.ctx.partiesModule.requisites.queries.findById(
        organizationRequisiteId,
      ),
    ]);

  if (!counterparty) {
    throw new NotFoundError("Counterparty", counterpartyId);
  }
  if (!organization) {
    throw new NotFoundError("Organization", organizationId);
  }
  if (!organizationRequisite) {
    throw new NotFoundError("Requisite", organizationRequisiteId);
  }

  const [organizationRequisiteCurrency, organizationRequisiteProvider] =
    await Promise.all([
      input.ctx.currenciesService.findById(organizationRequisite.currencyId),
      input.ctx.partiesModule.requisites.queries.findProviderById(
        organizationRequisite.providerId,
      ),
    ]);

  const fallbackCurrency =
    document.currency ?? readPayloadString(document.payload, "currency");
  const fallbackAmount =
    document.amountMinor != null && fallbackCurrency
      ? minorToAmountString(document.amountMinor, { currency: fallbackCurrency })
      : readPayloadString(document.payload, "amount");
  const calculation = await buildCalculationTemplateData({
    ctx: input.ctx,
    calculationId: deal.calculationId,
    fallbackAmount,
    fallbackCurrency,
  });

  return input.ctx.documentGenerationWorkflow.generateDealDocument({
    calculation,
    client: mapCounterpartyForTemplate(counterparty),
    contract: {
      contractDate: formatIsoDate(agreement.currentVersion.contractDate),
      contractNumber: agreement.currentVersion.contractNumber,
      id: agreement.id,
    },
    date: document.occurredAt,
    deal: {
      companyName: counterparty.fullName,
      companyNameI18n: toLocalizedText(
        counterparty.partyProfile?.profile?.fullNameI18n,
        counterparty.fullName,
      ),
      contractDate: formatIsoDate(agreement.currentVersion.contractDate),
      contractId: agreement.id,
      contractNumber: agreement.currentVersion.contractNumber,
      id: deal.id,
      invoiceDate: formatIsoDate(document.occurredAt),
      invoiceId: document.id,
      invoiceNumber: document.docNo,
    },
    format: input.format,
    lang: input.lang,
    organization: mapOrganizationForTemplate(organization),
    organizationRequisite: mapOrganizationRequisiteForTemplate({
      currencyCode: organizationRequisiteCurrency.code,
      provider: organizationRequisiteProvider,
      requisite: organizationRequisite,
    }),
    templateType: input.docType as "acceptance" | "application" | "invoice",
  });
}
