import type { AgreementsModule } from "@bedrock/agreements";
import type { AgreementDetails } from "@bedrock/agreements/contracts";
import type { CalculationsModule } from "@bedrock/calculations";
import type { CalculationDetails } from "@bedrock/calculations/contracts";
import type { CurrenciesService } from "@bedrock/currencies";
import type { DealsModule } from "@bedrock/deals";
import type { DocumentsService } from "@bedrock/documents";
import {
  findPartyAddress,
  findPartyIdentifier,
  findPartyRepresentative,
  findRequisiteIdentifier,
  findRequisiteProviderIdentifier,
  formatPartyAddress,
  formatRequisiteProviderAddress,
  formatRequisiteProviderAddressI18n,
  resolveRequisiteProviderCity,
  resolveRequisiteProviderCityI18n,
  resolveRequisiteProviderDisplayName,
  resolveRequisiteProviderDisplayNameI18n,
} from "@bedrock/parties";
import type { PartiesModule } from "@bedrock/parties";
import type {
  Counterparty,
  Organization,
  Requisite,
  RequisiteProvider,
} from "@bedrock/parties/contracts";
import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";
import { minorToAmountString } from "@bedrock/shared/money";

import {
  feeBpsToPercentString,
  minorToDecimalString,
  rationalToDecimalString,
  serializeRateSource,
} from "./calculation-document-formatters";
import {
  findPrintFormDefinition,
  listPrintFormDefinitions,
  toPrintFormDescriptor,
  type CalculationDocumentData,
  type ClientContractAgreement,
  type ClientContractFormat,
  type DocumentLanguage,
  type GeneratedDocument,
  type PrintFormDefinition,
  type PrintFormDescriptor,
  type PrintFormOwnerType,
  type PrintFormWarning,
  type RenderClientContractInput,
} from "./contracts";

export interface PrintFormApplicationDeps {
  agreementsModule: Pick<AgreementsModule, "agreements">;
  calculationsModule: Pick<CalculationsModule, "calculations">;
  currenciesService: Pick<CurrenciesService, "findById">;
  dealsModule: Pick<DealsModule, "deals">;
  documentsService: Pick<DocumentsService, "get">;
  documentGenerationWorkflow: {
    generateCalculation(input: {
      calculationData: CalculationDocumentData;
      format?: ClientContractFormat;
      lang?: DocumentLanguage;
      organizationId?: string;
    }): Promise<GeneratedDocument>;
    generateDealDocument(input: {
      calculation: Record<string, unknown>;
      client: Record<string, unknown>;
      contract: Record<string, unknown>;
      date?: Date;
      deal: Record<string, unknown>;
      format?: ClientContractFormat;
      invoice?: Record<string, unknown> | null;
      lang?: DocumentLanguage;
      organization: Record<string, unknown>;
      organizationRequisite: Record<string, unknown>;
      templateType: "acceptance" | "application" | "invoice";
    }): Promise<GeneratedDocument>;
    renderClientContract(
      input: RenderClientContractInput,
    ): Promise<GeneratedDocument>;
  };
  partiesModule: Pick<
    PartiesModule,
    "counterparties" | "organizations" | "requisites"
  >;
}

type PrintFormsContext = PrintFormApplicationDeps;

interface LocalizedText {
  en?: string | null;
  ru?: string | null;
}

function toLocalizedText(
  value: Record<string, string | null> | null | undefined,
  fallback?: string | null,
): LocalizedText | null {
  const ru = value?.ru ?? fallback ?? null;
  const en = value?.en ?? fallback ?? null;

  return ru || en ? { en, ru } : null;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function collectLocalizedWarning(
  warnings: PrintFormWarning[],
  input: {
    field: string;
    label: string;
    value: LocalizedText | null | undefined;
  },
) {
  if (!input.value || !hasText(input.value.ru) || !hasText(input.value.en)) {
    warnings.push({
      code: "missing_translation",
      field: input.field,
      message: `Missing bilingual value for ${input.label}`,
    });
  }
}

function collectSigningAssetWarnings(
  organization: Pick<Organization, "sealKey" | "signatureKey"> | Record<string, unknown>,
): PrintFormWarning[] {
  const signatureKey =
    "signatureKey" in organization && typeof organization.signatureKey === "string"
      ? organization.signatureKey
      : null;
  const sealKey =
    "sealKey" in organization && typeof organization.sealKey === "string"
      ? organization.sealKey
      : null;
  const warnings: PrintFormWarning[] = [];

  if (!signatureKey) {
    warnings.push({
      code: "missing_signing_asset",
      field: "organization.signatureKey",
      message: "Organization signature is not configured",
    });
  }

  if (!sealKey) {
    warnings.push({
      code: "missing_signing_asset",
      field: "organization.sealKey",
      message: "Organization seal is not configured",
    });
  }

  return warnings;
}

function descriptorFromDefinition(
  definition: PrintFormDefinition,
  warnings: PrintFormWarning[],
): PrintFormDescriptor {
  return toPrintFormDescriptor(definition, {
    quality: warnings.length > 0 ? "draft" : "ready",
    warnings,
  });
}

function descriptorsFor(input: {
  docType?: string | null;
  ownerType: PrintFormOwnerType;
  warnings?: PrintFormWarning[];
}): PrintFormDescriptor[] {
  return listPrintFormDefinitions({
    docType: input.docType,
    ownerType: input.ownerType,
  }).map((definition) =>
    descriptorFromDefinition(definition, input.warnings ?? []),
  );
}

function requireDefinition(input: {
  docType?: string | null;
  formId: string;
  ownerType: PrintFormOwnerType;
}): PrintFormDefinition {
  const definition = findPrintFormDefinition(input);

  if (!definition) {
    throw new ValidationError(
      `Print form ${input.formId} is not configured for ${input.ownerType}`,
    );
  }

  return definition;
}

function resolveDefinitionLanguage(
  definition: PrintFormDefinition,
): DocumentLanguage {
  return definition.languages.length === 1 && definition.languages[0] === "en"
    ? "en"
    : "ru";
}

function formatIsoDate(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function readPayloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function trimLeadingZeros(value: string): string {
  const trimmed = value.replace(/^0+(?=\d)/, "");
  return trimmed.length > 0 ? trimmed : "0";
}

function normalizeDecimalString(value: string): string {
  const [wholeRaw = "0", fractionRaw = ""] = value.split(".");
  const whole = trimLeadingZeros(wholeRaw);
  const fraction = fractionRaw.replace(/0+$/, "");

  return fraction.length > 0 ? `${whole}.${fraction}` : whole;
}

function shiftPositiveDecimalString(value: string, decimalPlaces: number) {
  const [wholeRaw, fractionRaw = ""] = value.split(".");
  const digits = `${wholeRaw}${fractionRaw}`.replace(/^0+(?=\d)/, "") || "0";
  const nextScale = fractionRaw.length - decimalPlaces;

  if (digits === "0") {
    return "0";
  }

  if (nextScale <= 0) {
    return normalizeDecimalString(`${digits}${"0".repeat(-nextScale)}`);
  }

  if (nextScale >= digits.length) {
    return normalizeDecimalString(
      `0.${"0".repeat(nextScale - digits.length)}${digits}`,
    );
  }

  const integerPart = digits.slice(0, digits.length - nextScale);
  const fractionPart = digits.slice(digits.length - nextScale);

  return normalizeDecimalString(`${integerPart}.${fractionPart}`);
}

function serializeAgreementFees(agreement: AgreementDetails) {
  let agentFee: string | null = null;
  let fixedFee: string | null = null;

  for (const rule of agreement.currentVersion.feeRules) {
    if (rule.kind === "agent_fee") {
      agentFee = shiftPositiveDecimalString(rule.value, -2);
      continue;
    }

    if (rule.kind === "fixed_fee") {
      fixedFee = normalizeDecimalString(rule.value);
    }
  }

  return { agentFee, fixedFee };
}

function serializeAgreementForClientContract(
  agreement: AgreementDetails,
): ClientContractAgreement {
  const fees = serializeAgreementFees(agreement);

  return {
    id: agreement.id,
    contractNumber: agreement.currentVersion.contractNumber,
    contractDate: formatIsoDate(agreement.currentVersion.contractDate),
    agentFee: fees.agentFee,
    fixedFee: fees.fixedFee,
  };
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
    kind: organization.kind,
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
    directorTitle: representative?.title ?? null,
    directorTitleI18n: toLocalizedText(representative?.titleI18n),
    directorBasis: representative?.basisDocument ?? null,
    directorBasisI18n: toLocalizedText(representative?.basisDocumentI18n),
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
    address:
      formatRequisiteProviderAddress({
        branchId: requisite.providerBranchId,
        provider,
      }) ?? null,
    addressI18n:
      formatRequisiteProviderAddressI18n({
        branchId: requisite.providerBranchId,
        provider,
      }) ?? null,
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
    institutionNameI18n:
      resolveRequisiteProviderDisplayNameI18n({
        branchId: requisite.providerBranchId,
        provider,
      }) ?? null,
    city:
      resolveRequisiteProviderCity({
        branchId: requisite.providerBranchId,
        provider,
      }) ?? null,
    cityI18n:
      resolveRequisiteProviderCityI18n({
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

function collectBilingualWarnings(input: {
  client: ReturnType<typeof mapCounterpartyForTemplate>;
  organization: ReturnType<typeof mapOrganizationForTemplate>;
  organizationRequisite: ReturnType<typeof mapOrganizationRequisiteForTemplate>;
}): PrintFormWarning[] {
  const warnings: PrintFormWarning[] = [];

  collectLocalizedWarning(warnings, {
    field: "client.orgName",
    label: "client name",
    value: input.client.orgNameI18n,
  });
  collectLocalizedWarning(warnings, {
    field: "client.directorName",
    label: "client director",
    value: input.client.directorNameI18n,
  });
  collectLocalizedWarning(warnings, {
    field: "organization.name",
    label: "organization name",
    value: input.organization.nameI18n,
  });
  collectLocalizedWarning(warnings, {
    field: "organization.directorName",
    label: "organization director",
    value: input.organization.directorNameI18n,
  });

  return warnings;
}

async function findProviderByIdOrNull(
  ctx: PrintFormsContext,
  providerId: string | null | undefined,
): Promise<RequisiteProvider | null> {
  if (!providerId) {
    return null;
  }

  return ctx.partiesModule.requisites.queries.findProviderById(providerId);
}

async function buildCalculationTemplateData(input: {
  ctx: PrintFormsContext;
  calculationId: string | null;
  fallbackAmount: string | null;
  fallbackCurrency: string | null;
}) {
  if (!input.calculationId) {
    return {
      additionalExpenses: "0",
      additionalExpensesInBase: "0",
      agreementFeeAmount: "0",
      agreementFeePercentage: "0",
      baseCurrencyCode: input.fallbackCurrency ?? "RUB",
      currencyCode: input.fallbackCurrency ?? "RUB",
      fixedFeeAmount: "0",
      fixedFeeCurrencyCode: null,
      finalRate: "1",
      id: "calculation",
      originalAmount: input.fallbackAmount ?? "0",
      paymentAmount: input.fallbackAmount ?? "0",
      paymentCurrencyCode: input.fallbackCurrency ?? "RUB",
      quoteMarkupAmount: "0",
      quoteMarkupPercentage: "0",
      rate: "1",
      totalAmount: input.fallbackAmount ?? "0",
      totalFeeAmount: "0",
      totalFeeAmountInBase: "0",
      totalFeePercentage: "0",
      totalInBase: input.fallbackAmount ?? "0",
      totalWithExpensesInBase: input.fallbackAmount ?? "0",
    };
  }

  const calculation =
    await input.ctx.calculationsModule.calculations.queries.findById(
      input.calculationId,
    );
  const snapshot = calculation?.currentSnapshot;

  if (!snapshot) {
    throw new NotFoundError("Calculation", input.calculationId);
  }

  const [calculationCurrency, baseCurrency, fixedFeeCurrency] =
    await Promise.all([
      input.ctx.currenciesService.findById(snapshot.calculationCurrencyId),
      input.ctx.currenciesService.findById(snapshot.baseCurrencyId),
      snapshot.fixedFeeCurrencyId
        ? input.ctx.currenciesService.findById(snapshot.fixedFeeCurrencyId)
        : Promise.resolve(null),
    ]);
  const quoteSnapshot = readRecord(snapshot.quoteSnapshot);
  const quoteSnapshotQuote = readRecord(quoteSnapshot?.quote) ?? quoteSnapshot;
  const paymentAmountMinor = readString(quoteSnapshotQuote?.toAmountMinor);
  const paymentCurrencyCode = readString(quoteSnapshotQuote?.toCurrency);
  const paymentAmount =
    paymentAmountMinor && paymentCurrencyCode
      ? minorToAmountString(paymentAmountMinor, { currency: paymentCurrencyCode })
      : minorToAmountString(snapshot.originalAmountMinor, {
          currency: calculationCurrency.code,
        });
  const paymentCurrencyCodeResolved =
    paymentCurrencyCode ?? calculationCurrency.code;

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
    finalRate: rationalToDecimalString(snapshot.rateDen, snapshot.rateNum),
    id: calculation.id,
    originalAmount: minorToAmountString(snapshot.originalAmountMinor, {
      currency: calculationCurrency.code,
    }),
    paymentAmount,
    paymentCurrencyCode: paymentCurrencyCodeResolved,
    quoteMarkupAmount: minorToAmountString(snapshot.quoteMarkupAmountMinor, {
      currency: calculationCurrency.code,
    }),
    quoteMarkupPercentage: snapshot.quoteMarkupBps,
    rate: rationalToDecimalString(snapshot.rateDen, snapshot.rateNum),
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

async function buildDealDocumentPrintContext(input: {
  actorUserId?: string;
  ctx: PrintFormsContext;
  dealId?: string;
  docType?: string;
  documentId?: string;
}) {
  const documentResult =
    input.docType && input.documentId
      ? await input.ctx.documentsService.get(
          input.docType,
          input.documentId,
          input.actorUserId ?? "",
        )
      : null;
  const document = documentResult?.document ?? null;
  const dealId = documentResult?.dealId ?? input.dealId;

  if (!dealId) {
    throw new ValidationError("Print form owner is not linked to a deal");
  }

  const deal = await input.ctx.dealsModule.deals.queries.findById(dealId);
  if (!deal) {
    throw new NotFoundError("Deal", dealId);
  }

  const workflow =
    await input.ctx.dealsModule.deals.queries.findWorkflowById(dealId);
  const agreement =
    await input.ctx.agreementsModule.agreements.queries.findById(
      deal.agreementId,
    );
  if (!agreement) {
    throw new NotFoundError("Agreement", deal.agreementId);
  }

  const linkedApplicationDocumentId = readPayloadString(
    document?.payload,
    "applicationDocumentId",
  );
  const linkedInvoiceDocumentId = readPayloadString(
    document?.payload,
    "invoiceDocumentId",
  );
  const [linkedApplicationResult, linkedInvoiceResult] = await Promise.all([
    linkedApplicationDocumentId
      ? input.ctx.documentsService
          .get(
            "application",
            linkedApplicationDocumentId,
            input.actorUserId ?? "",
          )
          .catch(() => null)
      : Promise.resolve(null),
    linkedInvoiceDocumentId
      ? input.ctx.documentsService
          .get("invoice", linkedInvoiceDocumentId, input.actorUserId ?? "")
          .catch(() => null)
      : Promise.resolve(null),
  ]);
  const applicationDocument =
    document?.docType === "application"
      ? document
      : (linkedApplicationResult?.document ?? null);
  const invoiceDocument =
    document?.docType === "invoice"
      ? document
      : (linkedInvoiceResult?.document ?? null);
  const businessPayloadDocument = applicationDocument ?? document;

  const counterpartyId =
    document?.counterpartyId ??
    businessPayloadDocument?.counterpartyId ??
    readPayloadString(businessPayloadDocument?.payload, "counterpartyId") ??
    readPayloadString(document?.payload, "counterpartyId") ??
    workflow?.participants.find((item) => item.role === "applicant")
      ?.counterpartyId ??
    workflow?.intake.common.applicantCounterpartyId ??
    deal.participants?.find((item) => item.role === "counterparty")
      ?.counterpartyId ??
    null;
  if (!counterpartyId) {
    throw new ValidationError(`Deal ${dealId} has no applicant counterparty`);
  }

  const organizationId =
    readPayloadString(businessPayloadDocument?.payload, "organizationId") ??
    readPayloadString(document?.payload, "organizationId") ??
    workflow?.participants.find((item) => item.role === "internal_entity")
      ?.organizationId ??
    agreement.organizationId;
  const organizationRequisiteId =
    document?.organizationRequisiteId ??
    businessPayloadDocument?.organizationRequisiteId ??
    readPayloadString(
      businessPayloadDocument?.payload,
      "organizationRequisiteId",
    ) ??
    readPayloadString(document?.payload, "organizationRequisiteId") ??
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

  const [
    organizationRequisiteCurrency,
    organizationRequisiteProvider,
    counterpartyBankRequisite,
  ] = await Promise.all([
    input.ctx.currenciesService.findById(organizationRequisite.currencyId),
    input.ctx.partiesModule.requisites.queries.findProviderById(
      organizationRequisite.providerId,
    ),
    input.ctx.partiesModule.requisites.queries.findPreferredCounterpartyBankByCounterpartyId(
      counterpartyId,
    ),
  ]);
  const counterpartyBankProvider = await findProviderByIdOrNull(
    input.ctx,
    counterpartyBankRequisite?.providerId,
  );
  const beneficiaryBankInstruction =
    workflow?.intake?.externalBeneficiary?.bankInstructionSnapshot ?? null;
  const fallbackCurrency =
    invoiceDocument?.currency ??
    document?.currency ??
    readPayloadString(invoiceDocument?.payload, "currency") ??
    readPayloadString(document?.payload, "currency") ??
    (deal.currencyId
      ? (await input.ctx.currenciesService.findById(deal.currencyId)).code
      : null);
  const fallbackAmount =
    invoiceDocument?.amountMinor != null && fallbackCurrency
      ? minorToAmountString(invoiceDocument.amountMinor, {
          currency: fallbackCurrency,
        })
      : document?.amountMinor != null && fallbackCurrency
        ? minorToAmountString(document.amountMinor, {
            currency: fallbackCurrency,
          })
        : readPayloadString(invoiceDocument?.payload, "amount") ??
          readPayloadString(document?.payload, "amount") ??
          deal.amount;
  const calculationId =
    readPayloadString(businessPayloadDocument?.payload, "calculationId") ??
    readPayloadString(document?.payload, "calculationId") ??
    deal.calculationId;
  const calculation = await buildCalculationTemplateData({
    ctx: input.ctx,
    calculationId,
    fallbackAmount,
    fallbackCurrency,
  });
  const client = mapCounterpartyForTemplate(counterparty);
  const organizationData = mapOrganizationForTemplate(organization);
  const organizationRequisiteData = mapOrganizationRequisiteForTemplate({
    currencyCode: organizationRequisiteCurrency.code,
    provider: organizationRequisiteProvider,
    requisite: organizationRequisite,
  });

  const warnings = [
    ...collectSigningAssetWarnings(organization),
    ...collectBilingualWarnings({
      client,
      organization: organizationData,
      organizationRequisite: organizationRequisiteData,
    }),
  ];

  return {
    calculation,
    client,
    contract: {
      contractDate: formatIsoDate(agreement.currentVersion.contractDate),
      contractNumber: agreement.currentVersion.contractNumber,
      id: agreement.id,
    },
    date: document?.occurredAt ?? new Date(),
    deal: {
      account:
        findRequisiteIdentifier(
          counterpartyBankRequisite,
          "local_account_number",
        )?.value ?? null,
      applicationNumber: applicationDocument?.docNo ?? null,
      acceptanceNumber:
        document?.docType === "acceptance" ? document.docNo : null,
      bankName:
        beneficiaryBankInstruction?.bankName ??
        resolveRequisiteProviderDisplayName({
          branchId: counterpartyBankRequisite?.providerBranchId,
          provider: counterpartyBankProvider,
        }) ??
        null,
      companyName: counterparty.fullName,
      companyNameI18n: toLocalizedText(
        counterparty.partyProfile?.profile?.fullNameI18n,
        counterparty.fullName,
      ),
      contractDate: formatIsoDate(agreement.currentVersion.contractDate),
      contractId: agreement.id,
      contractNumber: agreement.currentVersion.contractNumber,
      id: deal.id,
      invoiceDate: invoiceDocument
        ? formatIsoDate(invoiceDocument.occurredAt)
        : null,
      invoiceId: invoiceDocument?.id ?? null,
      invoiceNumber: invoiceDocument?.docNo ?? null,
      memo: readPayloadString(document?.payload, "memo"),
      swiftCode:
        beneficiaryBankInstruction?.swift ??
        findRequisiteProviderIdentifier({
          branchId: counterpartyBankRequisite?.providerBranchId,
          provider: counterpartyBankProvider,
          scheme: "swift",
        })?.value ?? null,
    },
    invoice: invoiceDocument
      ? {
          amount: fallbackAmount,
          currencyCode: fallbackCurrency,
          id: invoiceDocument.id,
          number: invoiceDocument.docNo,
        }
      : null,
    organization: organizationData,
    organizationRequisite: organizationRequisiteData,
    warnings,
  };
}

function filterWarningsForDefinition(
  definition: PrintFormDefinition,
  warnings: PrintFormWarning[],
): PrintFormWarning[] {
  if (definition.languageMode !== "bilingual") {
    return warnings.filter((warning) => warning.code === "missing_signing_asset");
  }

  return warnings;
}

async function listDocumentPrintForms(input: {
  actorUserId: string;
  ctx: PrintFormsContext;
  docType: string;
  documentId: string;
}): Promise<PrintFormDescriptor[]> {
  const definitions = listPrintFormDefinitions({
    docType: input.docType,
    ownerType: "document",
  });
  if (definitions.length === 0) {
    await input.ctx.documentsService.get(
      input.docType,
      input.documentId,
      input.actorUserId,
    );
    return [];
  }

  const context = await buildDealDocumentPrintContext(input);

  return definitions.map((definition) =>
    descriptorFromDefinition(
      definition,
      filterWarningsForDefinition(definition, context.warnings),
    ),
  );
}

async function generateDocumentPrintForm(input: {
  actorUserId: string;
  ctx: PrintFormsContext;
  docType: string;
  documentId: string;
  formId: string;
  format: ClientContractFormat;
}): Promise<GeneratedDocument> {
  const definition = requireDefinition({
    docType: input.docType,
    formId: input.formId,
    ownerType: "document",
  });
  const context = await buildDealDocumentPrintContext(input);

  return input.ctx.documentGenerationWorkflow.generateDealDocument({
    ...context,
    format: input.format,
    lang: resolveDefinitionLanguage(definition),
    templateType: definition.templateType as
      | "acceptance"
      | "application"
      | "invoice",
  });
}

async function listDealPrintForms(input: {
  ctx: PrintFormsContext;
  dealId: string;
}): Promise<PrintFormDescriptor[]> {
  const definitions = listPrintFormDefinitions({
    ownerType: "deal",
  });
  if (definitions.length === 0) {
    return [];
  }

  const context = await buildDealDocumentPrintContext(input);

  return definitions.map((definition) =>
    descriptorFromDefinition(
      definition,
      context.warnings.filter(
        (warning) => warning.code === "missing_signing_asset",
      ),
    ),
  );
}

async function generateDealPrintForm(input: {
  ctx: PrintFormsContext;
  dealId: string;
  formId: string;
  format: ClientContractFormat;
}): Promise<GeneratedDocument> {
  const definition = requireDefinition({
    formId: input.formId,
    ownerType: "deal",
  });
  const context = await buildDealDocumentPrintContext(input);

  return input.ctx.documentGenerationWorkflow.generateDealDocument({
    ...context,
    format: input.format,
    lang: resolveDefinitionLanguage(definition),
    templateType: definition.templateType as "application",
  });
}

async function serializeCalculationForPrintForm(input: {
  calculation: CalculationDetails;
  ctx: PrintFormsContext;
}): Promise<CalculationDocumentData> {
  const snapshot = input.calculation.currentSnapshot;
  const currencyIds = Array.from(
    new Set(
      [
        snapshot.calculationCurrencyId,
        snapshot.baseCurrencyId,
        snapshot.additionalExpensesCurrencyId,
        snapshot.fixedFeeCurrencyId,
      ].filter((value): value is string => Boolean(value)),
    ),
  );
  const currencies = new Map(
    await Promise.all(
      currencyIds.map(async (currencyId) => {
        const currency = await input.ctx.currenciesService.findById(currencyId);
        return [
          currencyId,
          {
            code: currency.code,
            id: currency.id,
            precision: currency.precision,
          },
        ] as const;
      }),
    ),
  );
  const calculationCurrency = currencies.get(snapshot.calculationCurrencyId);
  const baseCurrency = currencies.get(snapshot.baseCurrencyId);
  const additionalExpensesCurrency = snapshot.additionalExpensesCurrencyId
    ? currencies.get(snapshot.additionalExpensesCurrencyId) ?? null
    : null;

  if (!calculationCurrency || !baseCurrency) {
    throw new Error("Missing currency metadata for calculation print form");
  }

  return {
    id: input.calculation.id,
    currencyCode: calculationCurrency.code,
    originalAmount: minorToDecimalString(
      snapshot.originalAmountMinor,
      calculationCurrency.precision,
    ),
    agreementFeePercentage: feeBpsToPercentString(snapshot.agreementFeeBps),
    agreementFeeAmount: minorToDecimalString(
      snapshot.agreementFeeAmountMinor,
      calculationCurrency.precision,
    ),
    quoteMarkupPercentage: feeBpsToPercentString(snapshot.quoteMarkupBps),
    quoteMarkupAmount: minorToDecimalString(
      snapshot.quoteMarkupAmountMinor,
      calculationCurrency.precision,
    ),
    totalFeePercentage: feeBpsToPercentString(snapshot.totalFeeBps),
    totalFeeAmount: minorToDecimalString(
      snapshot.totalFeeAmountMinor,
      calculationCurrency.precision,
    ),
    totalAmount: minorToDecimalString(
      snapshot.totalAmountMinor,
      calculationCurrency.precision,
    ),
    finalRate: rationalToDecimalString(snapshot.rateNum, snapshot.rateDen),
    rateSource: serializeRateSource(snapshot.rateSource),
    rate: rationalToDecimalString(snapshot.rateNum, snapshot.rateDen),
    additionalExpenses: minorToDecimalString(
      snapshot.additionalExpensesAmountMinor,
      additionalExpensesCurrency?.precision ?? baseCurrency.precision,
    ),
    baseCurrencyCode: baseCurrency.code,
    totalFeeAmountInBase: minorToDecimalString(
      snapshot.totalFeeAmountInBaseMinor,
      baseCurrency.precision,
    ),
    fixedFeeAmount: snapshot.fixedFeeCurrencyId
      ? minorToDecimalString(
          snapshot.fixedFeeAmountMinor,
          currencies.get(snapshot.fixedFeeCurrencyId)?.precision ??
            baseCurrency.precision,
        )
      : minorToDecimalString(snapshot.fixedFeeAmountMinor, baseCurrency.precision),
    fixedFeeCurrencyCode:
      snapshot.fixedFeeCurrencyId != null
        ? (currencies.get(snapshot.fixedFeeCurrencyId)?.code ?? null)
        : null,
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
  };
}

async function listCalculationPrintForms(input: {
  ctx: PrintFormsContext;
  calculationId: string;
}): Promise<PrintFormDescriptor[]> {
  const calculation =
    await input.ctx.calculationsModule.calculations.queries.findById(
      input.calculationId,
    );

  if (!calculation) {
    throw new NotFoundError("Calculation", input.calculationId);
  }

  return descriptorsFor({ ownerType: "calculation" });
}

async function generateCalculationPrintForm(input: {
  ctx: PrintFormsContext;
  calculationId: string;
  formId: string;
  format: ClientContractFormat;
}): Promise<GeneratedDocument> {
  const definition = requireDefinition({
    formId: input.formId,
    ownerType: "calculation",
  });
  const calculation =
    await input.ctx.calculationsModule.calculations.queries.findById(
      input.calculationId,
    );

  if (!calculation) {
    throw new NotFoundError("Calculation", input.calculationId);
  }

  const calculationData = await serializeCalculationForPrintForm({
    calculation,
    ctx: input.ctx,
  });

  return input.ctx.documentGenerationWorkflow.generateCalculation({
    calculationData,
    format: input.format,
    lang: resolveDefinitionLanguage(definition),
  });
}

async function findCustomerContractCounterparty(
  ctx: PrintFormsContext,
  customerId: string,
): Promise<Counterparty> {
  const result = await ctx.partiesModule.counterparties.queries.list({
    customerId,
    limit: 1,
    offset: 0,
    relationshipKind: ["customer_owned"],
    sortBy: "createdAt",
    sortOrder: "asc",
  });
  const first = result.data[0];

  if (!first) {
    throw new ValidationError(
      `Customer ${customerId} has no customer-owned counterparty for contract print form`,
    );
  }

  const counterparty =
    await ctx.partiesModule.counterparties.queries.findById(first.id);
  if (!counterparty) {
    throw new NotFoundError("Counterparty", first.id);
  }

  return counterparty;
}

async function buildAgreementContractPrintContext(input: {
  agreementId: string;
  ctx: PrintFormsContext;
  versionId: string;
}) {
  const agreement =
    await input.ctx.agreementsModule.agreements.queries.findById(
      input.agreementId,
    );
  if (!agreement) {
    throw new NotFoundError("Agreement", input.agreementId);
  }
  if (agreement.currentVersion.id !== input.versionId) {
    throw new NotFoundError("Agreement version", input.versionId);
  }

  const [organization, organizationRequisite, counterparty] = await Promise.all([
    input.ctx.partiesModule.organizations.queries.findById(
      agreement.organizationId,
    ),
    input.ctx.partiesModule.requisites.queries.findOrganizationBankById(
      agreement.organizationRequisiteId,
    ),
    findCustomerContractCounterparty(input.ctx, agreement.customerId),
  ]);

  if (!organization) {
    throw new NotFoundError("Organization", agreement.organizationId);
  }
  if (!organizationRequisite) {
    throw new NotFoundError("Requisite", agreement.organizationRequisiteId);
  }

  const counterpartyBankRequisite =
    await input.ctx.partiesModule.requisites.queries.findPreferredCounterpartyBankByCounterpartyId(
      counterparty.id,
    );
  const [organizationProvider, counterpartyProvider] = await Promise.all([
    findProviderByIdOrNull(input.ctx, organizationRequisite.providerId),
    findProviderByIdOrNull(input.ctx, counterpartyBankRequisite?.providerId),
  ]);

  const client = mapCounterpartyForTemplate(counterparty);
  const organizationData = mapOrganizationForTemplate(organization);
  const organizationRequisiteData = mapOrganizationRequisiteForTemplate({
    currencyCode: organizationRequisite.currencyId,
    provider: organizationProvider,
    requisite: organizationRequisite,
  });
  const warnings = [
    ...collectSigningAssetWarnings(organization),
    ...collectBilingualWarnings({
      client,
      organization: organizationData,
      organizationRequisite: organizationRequisiteData,
    }),
  ];

  return {
    agreement,
    counterparty,
    counterpartyBankRequisite,
    counterpartyProvider,
    organization,
    organizationProvider,
    organizationRequisite,
    warnings,
  };
}

async function listAgreementVersionPrintForms(input: {
  agreementId: string;
  ctx: PrintFormsContext;
  versionId: string;
}): Promise<PrintFormDescriptor[]> {
  const context = await buildAgreementContractPrintContext(input);

  return descriptorsFor({
    ownerType: "agreement_version",
    warnings: context.warnings,
  });
}

async function generateAgreementVersionPrintForm(input: {
  agreementId: string;
  ctx: PrintFormsContext;
  formId: string;
  format: ClientContractFormat;
  versionId: string;
}): Promise<GeneratedDocument> {
  const definition = requireDefinition({
    formId: input.formId,
    ownerType: "agreement_version",
  });
  const context = await buildAgreementContractPrintContext(input);

  return input.ctx.documentGenerationWorkflow.renderClientContract({
    agreement: serializeAgreementForClientContract(context.agreement),
    clientBankProvider: context.counterpartyProvider,
    clientBankRequisite: context.counterpartyBankRequisite,
    clientCounterparty: context.counterparty,
    format: input.format,
    lang: resolveDefinitionLanguage(definition),
    organization: context.organization,
    organizationRequisite: context.organizationRequisite,
    organizationRequisiteProvider: context.organizationProvider,
  });
}

export function createPrintFormApplication(deps: PrintFormApplicationDeps) {
  return {
    generateAgreementVersionPrintForm: (
      input: Omit<
        Parameters<typeof generateAgreementVersionPrintForm>[0],
        "ctx"
      >,
    ) => generateAgreementVersionPrintForm({ ...input, ctx: deps }),
    generateCalculationPrintForm: (
      input: Omit<Parameters<typeof generateCalculationPrintForm>[0], "ctx">,
    ) => generateCalculationPrintForm({ ...input, ctx: deps }),
    generateDealPrintForm: (
      input: Omit<Parameters<typeof generateDealPrintForm>[0], "ctx">,
    ) => generateDealPrintForm({ ...input, ctx: deps }),
    generateDocumentPrintForm: (
      input: Omit<Parameters<typeof generateDocumentPrintForm>[0], "ctx">,
    ) => generateDocumentPrintForm({ ...input, ctx: deps }),
    listAgreementVersionPrintForms: (
      input: Omit<Parameters<typeof listAgreementVersionPrintForms>[0], "ctx">,
    ) => listAgreementVersionPrintForms({ ...input, ctx: deps }),
    listCalculationPrintForms: (
      input: Omit<Parameters<typeof listCalculationPrintForms>[0], "ctx">,
    ) => listCalculationPrintForms({ ...input, ctx: deps }),
    listDealPrintForms: (
      input: Omit<Parameters<typeof listDealPrintForms>[0], "ctx">,
    ) => listDealPrintForms({ ...input, ctx: deps }),
    listDocumentPrintForms: (
      input: Omit<Parameters<typeof listDocumentPrintForms>[0], "ctx">,
    ) => listDocumentPrintForms({ ...input, ctx: deps }),
  };
}
