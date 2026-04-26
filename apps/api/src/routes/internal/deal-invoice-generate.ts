import type { Calculation } from "@bedrock/calculations/contracts";
import type {
  Counterparty,
  Organization,
  Requisite,
  RequisiteProvider,
} from "@bedrock/parties/contracts";
import { NotFoundError, ValidationError } from "@bedrock/shared/core/errors";
import type {
  DocumentFormat,
  DocumentLang,
  GeneratedDocument,
} from "@bedrock/workflow-document-generation";

import type { AppContext } from "../../context";

interface GenerateDealInvoiceInput {
  ctx: AppContext;
  dealId: string;
  actorUserId: string;
  format: DocumentFormat;
  lang: DocumentLang;
  idempotencyKey: string;
  requestContext?: Parameters<
    AppContext["documentDraftWorkflow"]["createDraft"]
  >[0]["requestContext"];
}

export interface GenerateDealInvoiceResult {
  documentId: string;
  generated: GeneratedDocument;
}

export async function generateDealInvoice(
  input: GenerateDealInvoiceInput,
): Promise<GenerateDealInvoiceResult> {
  const { ctx, dealId } = input;

  const workflow = await ctx.dealsModule.deals.queries.findWorkflowById(dealId);
  if (!workflow) {
    throw new NotFoundError("Deal", dealId);
  }

  const calculationId = workflow.summary.calculationId;
  if (!calculationId) {
    throw new ValidationError(
      `Deal ${dealId} has no calculation; cannot generate invoice`,
    );
  }

  const calculation =
    await ctx.calculationsModule.calculations.queries.findById(calculationId);
  if (!calculation) {
    throw new NotFoundError("Calculation", calculationId);
  }

  const internalParticipant = workflow.participants.find(
    (participant) => participant.role === "internal_entity",
  );
  if (!internalParticipant?.organizationId) {
    throw new ValidationError(
      `Deal ${dealId} has no internal organization participant`,
    );
  }

  const organization = await ctx.partiesModule.organizations.queries.findById(
    internalParticipant.organizationId,
  );
  if (!organization) {
    throw new NotFoundError(
      "Organization",
      internalParticipant.organizationId,
    );
  }

  const applicantCounterpartyId =
    workflow.intake.common.applicantCounterpartyId;
  if (!applicantCounterpartyId) {
    throw new ValidationError(`Deal ${dealId} has no applicant counterparty`);
  }
  const counterparty =
    await ctx.partiesModule.counterparties.queries.findById(
      applicantCounterpartyId,
    );
  if (!counterparty) {
    throw new NotFoundError("Counterparty", applicantCounterpartyId);
  }

  const customerParticipant = workflow.participants.find(
    (participant) => participant.role === "customer",
  );
  const customerId =
    customerParticipant?.customerId ?? counterparty.customerId ?? null;
  if (!customerId) {
    throw new ValidationError(
      `Deal ${dealId} has no customer linked to its applicant`,
    );
  }

  // The invoice is what the customer pays — denominated in the calculation's
  // BASE currency (e.g. RUB), not the calculationCurrency which holds the
  // foreign-side amount (e.g. USD beneficiary total). The internal entity's
  // requisite must accept the base currency or the invoice plugin's domain
  // validation rejects with "Currency mismatch: invoice=X, account=Y".
  const invoiceCurrency = await ctx.currenciesService.findById(
    calculation.currentSnapshot.baseCurrencyId,
  );
  const requisiteId = await pickOrganizationRequisite({
    ctx,
    organizationId: organization.id,
    requisiteCurrencyId: calculation.currentSnapshot.baseCurrencyId,
  });
  if (!requisiteId) {
    throw new ValidationError(
      `Organization ${organization.id} has no requisite in ${invoiceCurrency.code}`,
    );
  }

  const requisite = await ctx.partiesModule.requisites.queries.findById(
    requisiteId,
  );
  if (!requisite) {
    throw new NotFoundError("Requisite", requisiteId);
  }

  const requisiteProvider =
    await ctx.partiesModule.requisites.queries.findProviderById(
      requisite.providerId,
    );

  const agreementId = workflow.summary.agreementId;
  const agreement = agreementId
    ? await ctx.agreementsModule.agreements.queries.findById(agreementId)
    : null;

  const customerTotalMinor =
    calculation.currentSnapshot.totalWithExpensesInBaseMinor;

  const documentId = await ensureInvoiceDocumentDraft({
    ctx,
    actorUserId: input.actorUserId,
    dealId,
    counterpartyId: counterparty.id,
    customerId,
    organizationId: organization.id,
    organizationRequisiteId: requisiteId,
    totalAmountMinor: customerTotalMinor,
    currencyCode: invoiceCurrency.code,
    currencyPrecision: invoiceCurrency.precision,
    idempotencyKey: input.idempotencyKey,
    requestContext: input.requestContext,
  });

  const generated =
    await ctx.documentGenerationWorkflow.generateDealDocument({
      templateType: "invoice",
      deal: dealToTemplateRecord(workflow),
      calculation: calculationToTemplateRecord({
        calculation,
        totalAmountMinor: customerTotalMinor,
        currencyCode: invoiceCurrency.code,
        currencyPrecision: invoiceCurrency.precision,
      }),
      client: counterpartyToTemplateRecord(counterparty),
      contract: agreement ? agreementToTemplateRecord(agreement) : {},
      organization: organizationToTemplateRecord(organization),
      organizationRequisite: requisiteToTemplateRecord({
        requisite,
        provider: requisiteProvider,
        currencyCode: invoiceCurrency.code,
      }),
      lang: input.lang,
      format: input.format,
    });

  return { documentId, generated };
}

async function pickOrganizationRequisite(input: {
  ctx: AppContext;
  organizationId: string;
  requisiteCurrencyId: string;
}): Promise<string | null> {
  const { ctx, organizationId, requisiteCurrencyId } = input;
  const requisites = await ctx.partiesModule.requisites.queries.list({
    limit: 100,
    offset: 0,
    ownerId: organizationId,
    ownerType: "organization",
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const match = requisites.data.find(
    (row) => row.currencyId === requisiteCurrencyId,
  );
  return match?.id ?? null;
}

interface EnsureInvoiceDocumentDraftInput {
  ctx: AppContext;
  actorUserId: string;
  dealId: string;
  counterpartyId: string;
  customerId: string;
  organizationId: string;
  organizationRequisiteId: string;
  totalAmountMinor: string;
  currencyCode: string;
  currencyPrecision: number;
  idempotencyKey: string;
  requestContext?: Parameters<
    AppContext["documentDraftWorkflow"]["createDraft"]
  >[0]["requestContext"];
}

async function ensureInvoiceDocumentDraft(
  input: EnsureInvoiceDocumentDraftInput,
): Promise<string> {
  const existing = await input.ctx.documentsService.list(
    {
      dealId: input.dealId,
      docType: ["invoice"],
      limit: 1,
      offset: 0,
      sortBy: "occurredAt",
      sortOrder: "desc",
    },
    input.actorUserId,
  );
  const existingDraft = existing.data.find(
    (entry) => entry.document.lifecycleStatus !== "cancelled",
  );
  if (existingDraft) {
    return existingDraft.document.id;
  }

  const amountMajor = minorStringToMajorString(
    input.totalAmountMinor,
    input.currencyPrecision,
  );

  const result = await input.ctx.documentDraftWorkflow.createDraft({
    actorUserId: input.actorUserId,
    createIdempotencyKey: input.idempotencyKey,
    dealId: input.dealId,
    docType: "invoice",
    payload: {
      amount: amountMajor,
      counterpartyId: input.counterpartyId,
      currency: input.currencyCode,
      customerId: input.customerId,
      financialLines: [],
      occurredAt: new Date().toISOString(),
      organizationId: input.organizationId,
      organizationRequisiteId: input.organizationRequisiteId,
    },
    requestContext: input.requestContext,
  });

  return result.document.id;
}

function minorStringToMajorString(
  amountMinor: string,
  precision: number,
): string {
  const trimmed = amountMinor.replace(/^-/, "");
  const negative = amountMinor.startsWith("-");
  const padded = trimmed.padStart(precision + 1, "0");
  const head = padded.slice(0, padded.length - precision);
  const tail = padded.slice(padded.length - precision);
  const fraction = precision > 0 ? `.${tail}` : "";
  return `${negative ? "-" : ""}${head}${fraction}`;
}

function findIdentifier(
  identifiers: { scheme: string; value: string }[],
  scheme: string,
): string | null {
  const match = identifiers.find(
    (identifier) => identifier.scheme.toLowerCase() === scheme,
  );
  return match?.value ?? null;
}

type WorkflowProjection = NonNullable<
  Awaited<
    ReturnType<AppContext["dealsModule"]["deals"]["queries"]["findWorkflowById"]>
  >
>;

function dealToTemplateRecord(
  workflow: WorkflowProjection,
): Record<string, unknown> {
  return {
    id: workflow.summary.id,
    contractDate: null,
    contractId: null,
    contractNumber: null,
    invoiceNumber: null,
    companyName: null,
  };
}

function calculationToTemplateRecord(input: {
  calculation: Calculation;
  totalAmountMinor: string;
  currencyCode: string;
  currencyPrecision: number;
}): Record<string, unknown> {
  return {
    id: input.calculation.id,
    currencyCode: input.currencyCode,
    totalAmount: minorStringToMajorString(
      input.totalAmountMinor,
      input.currencyPrecision,
    ),
  };
}

function counterpartyToTemplateRecord(
  counterparty: Counterparty,
): Record<string, unknown> {
  const profile = counterparty.partyProfile;
  const inn = profile
    ? findIdentifier(profile.identifiers, "inn") ??
      findIdentifier(profile.identifiers, "tax_id")
    : null;
  return {
    inn,
    orgName: counterparty.fullName ?? counterparty.shortName,
    orgType: null,
  };
}

function organizationToTemplateRecord(
  organization: Organization,
): Record<string, unknown> {
  const profile = organization.partyProfile;
  const inn = profile
    ? findIdentifier(profile.identifiers, "inn") ??
      findIdentifier(profile.identifiers, "tax_id")
    : null;
  const kpp = profile ? findIdentifier(profile.identifiers, "kpp") : null;
  const taxId = profile
    ? findIdentifier(profile.identifiers, "tax_id") ?? inn
    : inn;
  const address = profile?.address ?? null;
  return {
    id: organization.id,
    name: organization.shortName ?? organization.fullName,
    inn,
    taxId,
    kpp,
    address: address?.streetAddress ?? null,
    city: address?.city ?? null,
    country: address?.countryCode ?? organization.country ?? null,
  };
}

function requisiteToTemplateRecord(input: {
  requisite: Requisite;
  provider: RequisiteProvider | null;
  currencyCode: string;
}): Record<string, unknown> {
  const accountNo =
    findIdentifier(input.requisite.identifiers, "iban") ??
    findIdentifier(input.requisite.identifiers, "local_account_number") ??
    null;
  const swift = input.provider
    ? findIdentifier(input.provider.identifiers, "swift")
    : null;
  const bic = input.provider
    ? findIdentifier(input.provider.identifiers, "bic")
    : null;
  const corrAccount = input.provider
    ? findIdentifier(input.provider.identifiers, "corr_account")
    : null;
  return {
    accountNo,
    bic,
    swift,
    corrAccount,
    institutionName:
      input.provider?.legalName ?? input.provider?.displayName ?? null,
    currencyCode: input.currencyCode,
  };
}

function agreementToTemplateRecord(agreement: {
  id: string;
}): Record<string, unknown> {
  return {
    id: agreement.id,
    contractNumber: null,
    contractDate: null,
  };
}
