import type { AgreementsModule } from "@bedrock/agreements";
import type { CalculationsModule } from "@bedrock/calculations";
import type { CurrenciesService } from "@bedrock/currencies";
import { canDealWriteTreasuryOrFormalDocuments } from "@bedrock/deals";
import type { DealsModule as DealsModuleRoot } from "@bedrock/deals";
import {
  DealOperationalPosition,
  DealTimelineEvent,
  DealType,
  DealWorkflowProjection,
} from "@bedrock/deals/contracts";
import type { DocumentsReadModel } from "@bedrock/documents/read-model";
import type { FilesModule } from "@bedrock/files";
import type { IamService } from "@bedrock/iam";
import { type PartiesModule as PartiesModuleRoot } from "@bedrock/parties";
import type { Counterparty, Customer } from "@bedrock/parties/contracts";
import type { ReconciliationService } from "@bedrock/reconciliation";
import type { ReconciliationOperationLinkDto } from "@bedrock/reconciliation/contracts";
import { MAX_QUERY_LIST_LIMIT } from "@bedrock/shared/core";
import { NotFoundError } from "@bedrock/shared/core/errors";
import {
  formatFractionDecimal,
  minorToAmountString,
  toMinorAmountString,
} from "@bedrock/shared/money";
import type { TreasuryModule } from "@bedrock/treasury";
import type {
  QuoteListItem,
  TreasuryCashMovement,
  TreasuryExecutionFee,
  TreasuryExecutionFill,
  TreasuryInstruction,
  TreasuryOperationKind,
} from "@bedrock/treasury/contracts";

import {
  deriveFinanceDealReadiness,
  deriveFinanceDealStage,
} from "./close-readiness";
import type {
  CrmDealByStatusItem,
  CrmDealBoardProjection,
  CrmDealBoardStage,
  CrmDealCustomerContext,
  CrmDealListItem,
  CrmDealWorkbenchProjection,
  CrmDealsByDayItem,
  CrmDealsByDayQuery,
  CrmDealsByStatus,
  CrmDealsListProjection,
  CrmDealsListQuery,
  CrmDealsStats,
  CrmDealsStatsQuery,
  FinanceDealQueue,
  FinanceDealQueueFilters,
  FinanceDealQueueProjection,
  FinanceDealQueueItem,
  FinanceProfitabilityAmount,
  FinanceProfitabilitySnapshot,
  FinanceProfitabilityVarianceSnapshot,
  FinanceDealWorkspaceProjection,
  PortalDealListProjection,
  PortalDealProjection,
} from "./contracts";
import { CrmDealsListQuerySchema } from "./contracts";

const CUSTOMER_SAFE_INVOICE_REQUIRED_ACTION = "Загрузите инвойс";
const EXTERNAL_EVIDENCE_REQUIRED_MESSAGE =
  "Загрузите подтверждающие документы по сделке";
const PAYMENT_INVOICE_REQUIRED_MESSAGE = "Инвойс по сделке не загружен";
const PORTAL_OWNED_SECTIONS_BY_TYPE: Record<DealType, string[]> = {
  currency_exchange: ["common", "moneyRequest"],
  currency_transit: ["common", "moneyRequest", "incomingReceipt"],
  exporter_settlement: ["common", "moneyRequest", "incomingReceipt"],
  internal_treasury: ["common", "moneyRequest", "settlementDestination"],
  payment: ["common", "moneyRequest"],
};

const OPENING_DOCUMENT_TYPE_BY_DEAL_TYPE: Record<DealType, string> = {
  currency_exchange: "exchange",
  currency_transit: "invoice",
  exporter_settlement: "invoice",
  internal_treasury: "exchange",
  payment: "invoice",
};

const CLOSING_DOCUMENT_TYPE_BY_DEAL_TYPE: Record<DealType, string | null> = {
  currency_exchange: null,
  currency_transit: "acceptance",
  exporter_settlement: "acceptance",
  internal_treasury: null,
  payment: "acceptance",
};

const DOWNSTREAM_POSITION_KINDS = new Set([
  "exporter_expected_receivable",
  "in_transit",
  "provider_payable",
]);

const DOWNSTREAM_LEG_KINDS = new Set([
  "payout",
  "settle_exporter",
  "transit_hold",
]);

export interface DealProjectionsWorkflowDeps {
  agreements: Pick<AgreementsModule, "agreements">;
  calculations: Pick<CalculationsModule, "calculations">;
  currencies: Pick<CurrenciesService, "findById">;
  deals: Pick<DealsModuleRoot, "deals">;
  documentsReadModel: Pick<DocumentsReadModel, "listDealTraceRowsByDealId">;
  files: Pick<FilesModule, "files">;
  iam: {
    queries: Pick<IamService["queries"], "findById">;
  };
  parties: Pick<
    PartiesModuleRoot,
    "counterparties" | "customers" | "organizations" | "requisites"
  >;
  reconciliation: Pick<ReconciliationService, "links">;
  treasury: Pick<TreasuryModule, "instructions" | "operations" | "quotes">;
}

export type ListFinanceDealQueuesInput = FinanceDealQueueFilters;
type CalculationDetailsLike = NonNullable<
  Awaited<ReturnType<CalculationsModule["calculations"]["queries"]["findById"]>>
>;
type CurrencyDetailsLike = Awaited<
  ReturnType<DealProjectionsWorkflowDeps["currencies"]["findById"]>
>;
type DealListRecord = Awaited<
  ReturnType<DealsModuleRoot["deals"]["queries"]["list"]>
>["data"][number];
type CustomerListItemLike = Awaited<
  ReturnType<PartiesModuleRoot["customers"]["queries"]["listByIds"]>
>[number];
type TreasuryQuoteRecord = Awaited<
  ReturnType<TreasuryModule["quotes"]["queries"]["listQuotes"]>
>["data"][number];
type TreasuryOperationRecord = Awaited<
  ReturnType<TreasuryModule["operations"]["queries"]["list"]>
>["data"][number];
type UserDetailsLike = Awaited<
  ReturnType<DealProjectionsWorkflowDeps["iam"]["queries"]["findById"]>
>;

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

async function buildPortalCalculationSummary(input: {
  calculation: CalculationDetailsLike | null;
  currencies: Pick<CurrenciesService, "findById">;
}) {
  if (!input.calculation) {
    return null;
  }

  const snapshot = input.calculation.currentSnapshot;
  const currencyIds = Array.from(
    new Set(
      [
        snapshot.calculationCurrencyId,
        snapshot.baseCurrencyId,
        snapshot.additionalExpensesCurrencyId,
        snapshot.fixedFeeCurrencyId,
      ].filter((currencyId): currencyId is string => Boolean(currencyId)),
    ),
  );
  const currencies = await loadOptionalLookupMap(
    currencyIds,
    (currencyId) => input.currencies.findById(currencyId),
  );
  const calculationCurrency = currencies.get(snapshot.calculationCurrencyId);
  const baseCurrency = currencies.get(snapshot.baseCurrencyId);
  const additionalExpensesCurrency = snapshot.additionalExpensesCurrencyId
    ? (currencies.get(snapshot.additionalExpensesCurrencyId) ?? null)
    : null;
  const fixedFeeCurrency = snapshot.fixedFeeCurrencyId
    ? (currencies.get(snapshot.fixedFeeCurrencyId) ?? null)
    : null;

  if (!calculationCurrency || !baseCurrency) {
    return null;
  }

  return {
    additionalExpenses: minorToDecimalString(
      snapshot.additionalExpensesAmountMinor,
      additionalExpensesCurrency?.precision ?? baseCurrency.precision,
    ),
    additionalExpensesCurrencyCode: additionalExpensesCurrency?.code ?? null,
    agreementFeeAmount: minorToDecimalString(
      snapshot.agreementFeeAmountMinor,
      calculationCurrency.precision,
    ),
    agreementFeePercentage: feeBpsToPercentString(snapshot.agreementFeeBps),
    baseCurrencyCode: baseCurrency.code,
    calculationTimestamp: snapshot.calculationTimestamp,
    currencyCode: calculationCurrency.code,
    fixedFeeAmount: minorToDecimalString(
      snapshot.fixedFeeAmountMinor,
      fixedFeeCurrency?.precision ?? baseCurrency.precision,
    ),
    fixedFeeCurrencyCode: fixedFeeCurrency?.code ?? null,
    id: input.calculation.id,
    originalAmount: minorToDecimalString(
      snapshot.originalAmountMinor,
      calculationCurrency.precision,
    ),
    quoteMarkupAmount: minorToDecimalString(
      snapshot.quoteMarkupAmountMinor,
      calculationCurrency.precision,
    ),
    quoteMarkupPercentage: feeBpsToPercentString(snapshot.quoteMarkupBps),
    rate: rationalToDecimalString(snapshot.rateNum, snapshot.rateDen),
    totalAmount: minorToDecimalString(
      snapshot.totalAmountMinor,
      calculationCurrency.precision,
    ),
    totalFeeAmount: minorToDecimalString(
      snapshot.totalFeeAmountMinor,
      calculationCurrency.precision,
    ),
    totalFeeAmountInBase: minorToDecimalString(
      snapshot.totalFeeAmountInBaseMinor,
      baseCurrency.precision,
    ),
    totalFeePercentage: feeBpsToPercentString(snapshot.totalFeeBps),
    totalInBase: minorToDecimalString(
      snapshot.totalInBaseMinor,
      baseCurrency.precision,
    ),
    totalWithExpensesInBase: minorToDecimalString(
      snapshot.totalWithExpensesInBaseMinor,
      baseCurrency.precision,
    ),
  };
}

function parseOptionalSet(value?: string): Set<string> | null {
  if (!value) {
    return null;
  }

  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items.length > 0 ? new Set(items) : null;
}

function parseDecimalOrZero(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMinorOrZero(
  value: string | bigint | null | undefined,
  precision: number | null | undefined,
): number {
  if (value == null || precision == null) {
    return 0;
  }

  return parseDecimalOrZero(minorToAmountString(value, { precision }));
}

function toMinorOrZero(
  value: string | null | undefined,
  currencyCode: string,
): bigint {
  return BigInt(toMinorAmountString(value ?? "0", currencyCode));
}

function compareBigInt(left: bigint, right: bigint): number {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

function compareNullableStrings(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  return (left ?? "").localeCompare(right ?? "", "ru");
}

function compareNullableDates(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  const leftValue = left ? new Date(left).getTime() : 0;
  const rightValue = right ? new Date(right).getTime() : 0;
  return leftValue - rightValue;
}

function toMap<K, V>(entries: readonly (readonly [K, V])[]): Map<K, V> {
  return new Map(entries);
}

async function resolveOptionalLookup<T>(
  load: () => Promise<T | null>,
): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    if (
      error instanceof NotFoundError ||
      (error instanceof Error && error.name.endsWith("NotFoundError"))
    ) {
      return null;
    }

    throw error;
  }
}

async function loadOptionalLookupMap<T>(
  ids: readonly string[],
  load: (id: string) => Promise<T | null>,
): Promise<Map<string, NonNullable<T>>> {
  const map = new Map<string, NonNullable<T>>();
  const entries = await Promise.all(
    ids.map(async (id) => {
      const value = await resolveOptionalLookup(() => load(id));
      return value ? ([id, value] as const) : null;
    }),
  );

  for (const entry of entries) {
    if (entry) {
      map.set(entry[0], entry[1] as NonNullable<T>);
    }
  }

  return map;
}

function buildCrmDealMoneySummary(input: {
  deal: DealListRecord;
  calculation: CalculationDetailsLike | null;
  sourceCurrency: CurrencyDetailsLike | null;
  baseCurrency: CurrencyDetailsLike | null;
}) {
  const currencyCode = input.sourceCurrency?.code ?? "RUB";
  const sourcePrecision = input.sourceCurrency?.precision ?? 2;
  const amountMinor = toMinorOrZero(input.deal.amount, currencyCode);
  const amount = parseDecimalOrZero(input.deal.amount);

  const amountInBaseMinor =
    input.calculation && input.baseCurrency
      ? BigInt(input.calculation.currentSnapshot.totalInBaseMinor)
      : amountMinor;
  const amountInBase =
    input.calculation && input.baseCurrency
      ? parseMinorOrZero(
          input.calculation.currentSnapshot.totalInBaseMinor,
          input.baseCurrency.precision,
        )
      : parseMinorOrZero(amountMinor, sourcePrecision);
  const feePercentage = input.calculation
    ? parseMinorOrZero(input.calculation.currentSnapshot.totalFeeBps, 2)
    : 0;

  return {
    amount,
    amountInBase,
    amountInBaseMinor,
    amountMinor,
    baseCurrencyCode: input.baseCurrency?.code ?? currencyCode,
    currencyCode,
    feePercentage,
  };
}

async function loadDealMoneyLookups(
  listedDeals: DealListRecord[],
  deps: Pick<DealProjectionsWorkflowDeps, "calculations" | "currencies">,
) {
  const calculationIds = [
    ...new Set(
      listedDeals
        .map((deal) => deal.calculationId)
        .filter((calculationId): calculationId is string =>
          Boolean(calculationId),
        ),
    ),
  ];
  const sourceCurrencyIds = [
    ...new Set(
      listedDeals
        .map((deal) => deal.currencyId)
        .filter((currencyId): currencyId is string => Boolean(currencyId)),
    ),
  ];

  const calculationsById = toMap(
    await Promise.all(
      calculationIds.map(
        async (
          calculationId,
        ): Promise<readonly [string, CalculationDetailsLike | null]> =>
          [
            calculationId,
            (await resolveOptionalLookup(() =>
              deps.calculations.calculations.queries.findById(calculationId),
            )) ?? null,
          ] as const,
      ),
    ),
  );
  const baseCurrencyIds = [
    ...new Set(
      Array.from(calculationsById.values())
        .map(
          (calculation) => calculation?.currentSnapshot.baseCurrencyId ?? null,
        )
        .filter((currencyId): currencyId is string => Boolean(currencyId)),
    ),
  ];

  const [currenciesById, baseCurrenciesById] = await Promise.all([
    loadOptionalLookupMap(sourceCurrencyIds, (currencyId) =>
      deps.currencies.findById(currencyId),
    ),
    loadOptionalLookupMap(baseCurrencyIds, (currencyId) =>
      deps.currencies.findById(currencyId),
    ),
  ]);

  return {
    baseCurrenciesById,
    calculationsById,
    currenciesById,
  };
}

function getCustomerParticipant(workflow: DealWorkflowProjection) {
  return workflow.participants.find(
    (participant) => participant.role === "customer",
  );
}

function getApplicantParticipant(workflow: DealWorkflowProjection) {
  return workflow.participants.find(
    (participant) => participant.role === "applicant",
  );
}

function getInternalEntityParticipant(workflow: DealWorkflowProjection) {
  return workflow.participants.find(
    (participant) => participant.role === "internal_entity",
  );
}

function serializeCrmPricingQuote(quote: TreasuryQuoteRecord): QuoteListItem {
  const fromCurrency = quote.fromCurrency ?? "—";
  const toCurrency = quote.toCurrency ?? "—";

  return {
    createdAt: quote.createdAt.toISOString(),
    commercialTerms: quote.commercialTerms
      ? {
          agreementVersionId: quote.commercialTerms.agreementVersionId,
          agreementFeeBps: quote.commercialTerms.agreementFeeBps.toString(),
          quoteMarkupBps: quote.commercialTerms.quoteMarkupBps.toString(),
          totalFeeBps: quote.commercialTerms.totalFeeBps.toString(),
          fixedFeeAmountMinor:
            quote.commercialTerms.fixedFeeAmountMinor?.toString() ?? null,
          fixedFeeCurrency: quote.commercialTerms.fixedFeeCurrency ?? null,
        }
      : null,
    dealDirection: quote.dealDirection,
    dealForm: quote.dealForm,
    dealId: quote.dealId,
    expiresAt: quote.expiresAt.toISOString(),
    fromAmount: minorToAmountString(quote.fromAmountMinor, {
      currency: fromCurrency,
    }),
    fromAmountMinor: quote.fromAmountMinor.toString(),
    fromCurrency,
    fromCurrencyId: quote.fromCurrencyId,
    id: quote.id,
    idempotencyKey: quote.idempotencyKey,
    pricingMode: quote.pricingMode,
    pricingTrace: quote.pricingTrace ?? {},
    rateDen: quote.rateDen.toString(),
    rateNum: quote.rateNum.toString(),
    status: quote.status,
    toAmount: minorToAmountString(quote.toAmountMinor, {
      currency: toCurrency,
    }),
    toAmountMinor: quote.toAmountMinor.toString(),
    toCurrency,
    toCurrencyId: quote.toCurrencyId,
    usedAt: quote.usedAt?.toISOString() ?? null,
    usedByRef: quote.usedByRef,
    usedDocumentId: quote.usedDocumentId,
  };
}

function getCustomerSafeTimeline(
  timeline: DealTimelineEvent[],
): DealTimelineEvent[] {
  return timeline.filter((event) => event.visibility === "customer_safe");
}

function buildCustomerSafeAttachments(
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >,
  workflow: DealWorkflowProjection,
) {
  const ingestionsByAttachmentId = new Map(
    workflow.attachmentIngestions.map((ingestion) => [
      ingestion.fileAssetId,
      ingestion,
    ]),
  );

  return attachments
    .filter((attachment) => attachment.visibility === "customer_safe")
    .map((attachment) => {
      const ingestion = ingestionsByAttachmentId.get(attachment.id) ?? null;
      const ingestionStatus =
        !attachment.purpose || attachment.purpose === "other"
          ? null
          : !ingestion
            ? null
            : ingestion.status === "pending" ||
                ingestion.status === "processing"
              ? ("processing" as const)
              : ingestion.status === "processed"
                ? ("applied" as const)
                : ingestion.errorCode === "extractor_unconfigured" ||
                    ingestion.errorCode === "storage_unconfigured"
                  ? ("unavailable" as const)
                  : ("failed" as const);

      return {
        createdAt: attachment.createdAt,
        fileName: attachment.fileName,
        id: attachment.id,
        ingestionStatus,
        purpose: attachment.purpose,
      };
    })
    .sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );
}

function buildPortalQuoteSummary(workflow: DealWorkflowProjection) {
  const acceptedPricingQuoteId =
    workflow.acceptedCalculation?.quoteProvenance?.sourceQuoteId ??
    workflow.acceptedCalculation?.quoteProvenance?.fxQuoteId ??
    null;

  if (acceptedPricingQuoteId) {
    const acceptedPricingQuote =
      workflow.relatedResources.quotes.find(
        (quote) => quote.id === acceptedPricingQuoteId,
      ) ?? null;

    return {
      expiresAt: toDateOrNull(acceptedPricingQuote?.expiresAt),
      quoteId: acceptedPricingQuoteId,
      status: acceptedPricingQuote?.status ?? null,
    };
  }

  const activeOrLatestQuote = [...workflow.relatedResources.quotes].sort(
    (left, right) => {
      const leftTime = getDateTimeValue(left.expiresAt);
      const rightTime = getDateTimeValue(right.expiresAt);
      return rightTime - leftTime;
    },
  )[0];

  if (!activeOrLatestQuote) {
    return null;
  }

  return {
    expiresAt: toDateOrNull(activeOrLatestQuote.expiresAt),
    quoteId: activeOrLatestQuote.id,
    status: activeOrLatestQuote.status,
  };
}

function toDateOrNull(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

function getDateTimeValue(value: Date | string | null | undefined) {
  const date = toDateOrNull(value);
  return date?.getTime() ?? 0;
}

function hasAttachmentPurpose(
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >,
  purpose: "contract" | "invoice",
  visibility?: "customer_safe" | "internal",
) {
  return attachments.some(
    (attachment) =>
      attachment.purpose === purpose &&
      (visibility ? attachment.visibility === visibility : true),
  );
}

function buildPortalSubmissionCompleteness(input: {
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >;
  workflow: DealWorkflowProjection;
}) {
  const relevantSectionIds = new Set(
    PORTAL_OWNED_SECTIONS_BY_TYPE[input.workflow.header.type],
  );
  const blockingReasons = input.workflow.sectionCompleteness
    .filter((section) => relevantSectionIds.has(section.sectionId))
    .flatMap((section) => section.blockingReasons);

  if (
    input.workflow.summary.type === "payment" &&
    !hasAttachmentPurpose(input.attachments, "invoice", "customer_safe")
  ) {
    blockingReasons.push(CUSTOMER_SAFE_INVOICE_REQUIRED_ACTION);
  }

  return {
    blockingReasons,
    complete: blockingReasons.length === 0,
  };
}

function isDealInTerminalStatus(workflow: DealWorkflowProjection) {
  return [
    "closed",
    "cancelled",
    "rejected",
    "expired",
    "failed",
  ].includes(workflow.summary.status);
}

function requiresExternalEvidence(type: DealType) {
  return type !== "currency_exchange";
}

function hasCustomerSafeAttachment(
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >,
) {
  return attachments.some(
    (attachment) => attachment.visibility === "customer_safe",
  );
}

function isFormalDocumentReady(input: {
  approvalStatus: string | null;
  lifecycleStatus: string | null;
  postingStatus: string | null;
  submissionStatus: string | null;
}) {
  return (
    input.lifecycleStatus === "active" &&
    input.submissionStatus === "submitted" &&
    (input.approvalStatus === "approved" ||
      input.approvalStatus === "not_required") &&
    (input.postingStatus === "posted" || input.postingStatus === "not_required")
  );
}

function findRelatedFormalDocument(input: {
  docType: string;
  documents: DealWorkflowProjection["relatedResources"]["formalDocuments"];
}) {
  const matching = input.documents.filter(
    (document) => document.docType === input.docType,
  );

  return (
    matching.find((document) => document.lifecycleStatus === "active") ??
    matching.sort((left, right) => {
      const leftTime =
        left.createdAt?.getTime() ?? left.occurredAt?.getTime() ?? 0;
      const rightTime =
        right.createdAt?.getTime() ?? right.occurredAt?.getTime() ?? 0;
      return rightTime - leftTime;
    })[0] ??
    null
  );
}

function buildCrmEvidenceRequirements(input: {
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >;
  workflow: DealWorkflowProjection;
}) {
  if (input.workflow.summary.type === "payment") {
    const hasInvoice = hasAttachmentPurpose(input.attachments, "invoice");
    const hasContract = hasAttachmentPurpose(input.attachments, "contract");

    return [
      {
        blockingReasons: hasInvoice ? [] : [PAYMENT_INVOICE_REQUIRED_MESSAGE],
        code: "invoice",
        label: "Инвойс",
        state: hasInvoice ? ("provided" as const) : ("missing" as const),
      },
      {
        blockingReasons: [],
        code: "contract",
        label: "Договор",
        state: hasContract ? ("provided" as const) : ("not_required" as const),
      },
    ];
  }

  if (!requiresExternalEvidence(input.workflow.summary.type)) {
    return [
      {
        blockingReasons: [],
        code: "external_evidence",
        label: "Внешние подтверждающие документы",
        state: "not_required" as const,
      },
    ];
  }

  const evidenceProvided = hasCustomerSafeAttachment(input.attachments);

  return [
    {
      blockingReasons: evidenceProvided
        ? []
        : [EXTERNAL_EVIDENCE_REQUIRED_MESSAGE],
      code: "external_evidence",
      label: "Внешние подтверждающие документы",
      state: evidenceProvided ? ("provided" as const) : ("missing" as const),
    },
  ];
}

function buildCrmDocumentRequirements(workflow: DealWorkflowProjection) {
  const requirements: {
    activeDocumentId: string | null;
    blockingReasons: string[];
    createAllowed: boolean;
    docType: string;
    openAllowed: boolean;
    stage: "opening" | "closing";
    state: "in_progress" | "missing" | "not_required" | "ready";
  }[] = [];

  const openingDocType =
    OPENING_DOCUMENT_TYPE_BY_DEAL_TYPE[workflow.summary.type];
  const closingDocType =
    CLOSING_DOCUMENT_TYPE_BY_DEAL_TYPE[workflow.summary.type];
  const createAllowed = canDealWriteTreasuryOrFormalDocuments({
    status: workflow.summary.status,
    type: workflow.summary.type,
  });

  for (const [stage, docType] of [
    ["opening", openingDocType] as const,
    ["closing", closingDocType] as const,
  ]) {
    if (!docType) {
      continue;
    }

    const document = findRelatedFormalDocument({
      docType,
      documents: workflow.relatedResources.formalDocuments,
    });
    const ready = document
      ? isFormalDocumentReady({
          approvalStatus: document.approvalStatus,
          lifecycleStatus: document.lifecycleStatus,
          postingStatus: document.postingStatus,
          submissionStatus: document.submissionStatus,
        })
      : false;

    requirements.push({
      activeDocumentId: document?.id ?? null,
      blockingReasons: document
        ? ready
          ? []
          : ["Формальный документ еще не готов к использованию"]
        : ["Формальный документ еще не создан"],
      createAllowed: !document && createAllowed,
      docType,
      openAllowed: Boolean(document?.id),
      stage,
      state: !document ? "missing" : ready ? "ready" : "in_progress",
    });
  }

  return requirements;
}

function countCounterpartySnapshotFields(
  snapshot: DealWorkflowProjection["header"]["externalBeneficiary"]["beneficiarySnapshot"],
) {
  if (!snapshot) {
    return 0;
  }

  return [
    snapshot.country,
    snapshot.displayName,
    snapshot.inn,
    snapshot.legalName,
  ].filter((value) => Boolean(value)).length;
}

function countBankInstructionFields(
  snapshot: DealWorkflowProjection["header"]["externalBeneficiary"]["bankInstructionSnapshot"],
) {
  if (!snapshot) {
    return 0;
  }

  return [
    snapshot.accountNo,
    snapshot.bankAddress,
    snapshot.bankCountry,
    snapshot.bankName,
    snapshot.beneficiaryName,
    snapshot.bic,
    snapshot.corrAccount,
    snapshot.iban,
    snapshot.label,
    snapshot.swift,
  ].filter((value) => Boolean(value)).length;
}

function buildCrmBeneficiaryDraft(input: {
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >;
  workflow: DealWorkflowProjection;
}) {
  if (input.workflow.header.externalBeneficiary.beneficiaryCounterpartyId) {
    return null;
  }

  const attachmentById = new Map(
    input.attachments.map((attachment) => [attachment.id, attachment]),
  );
  const candidate = [...input.workflow.attachmentIngestions]
    .filter(
      (ingestion) =>
        ingestion.status === "processed" &&
        (ingestion.normalizedPayload?.beneficiarySnapshot ||
          ingestion.normalizedPayload?.bankInstructionSnapshot),
    )
    .sort((left, right) => {
      const leftAttachment = attachmentById.get(left.fileAssetId);
      const rightAttachment = attachmentById.get(right.fileAssetId);
      const leftRank = leftAttachment?.purpose === "invoice" ? 0 : 1;
      const rightRank = rightAttachment?.purpose === "invoice" ? 0 : 1;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      const leftTime = left.lastProcessedAt?.getTime() ?? 0;
      const rightTime = right.lastProcessedAt?.getTime() ?? 0;
      return rightTime - leftTime;
    })[0];

  if (!candidate?.normalizedPayload) {
    return null;
  }

  return {
    bankInstructionSnapshot:
      candidate.normalizedPayload.bankInstructionSnapshot,
    beneficiarySnapshot: candidate.normalizedPayload.beneficiarySnapshot,
    fieldPresence: {
      bankInstructionFields: countBankInstructionFields(
        candidate.normalizedPayload.bankInstructionSnapshot,
      ),
      beneficiaryFields: countCounterpartySnapshotFields(
        candidate.normalizedPayload.beneficiarySnapshot,
      ),
    },
    purpose: attachmentById.get(candidate.fileAssetId)?.purpose ?? null,
    sourceAttachmentId: candidate.fileAssetId,
  };
}

function buildCrmWorkbenchActions(workflow: DealWorkflowProjection) {
  return {
    canChangeAgreement: workflow.summary.status === "draft",
    canCreateCalculation: false,
    canCreateFormalDocument: false,
    canCreateQuote:
      isQuoteEligible(workflow) && !isDealInTerminalStatus(workflow),
    canEditHeader: !isDealInTerminalStatus(workflow),
    canReassignAssignee: true,
    canUploadAttachment: !isDealInTerminalStatus(workflow),
  };
}

function isExecutionRequestAllowed(workflow: DealWorkflowProjection) {
  if (
    workflow.summary.status === "approved_for_execution" ||
    workflow.summary.status === "executing" ||
    workflow.summary.status === "partially_executed"
  ) {
    return true;
  }

  const readiness = workflow.transitionReadiness.find(
    (item) => item.targetStatus === "approved_for_execution",
  );

  return readiness?.allowed ?? false;
}

function getInstructionActions(input: {
  isBlockedWithoutInstruction: boolean;
  latestInstruction: TreasuryInstruction | null;
}) {
  const latestInstruction = input.latestInstruction;

  return {
    canPrepareInstruction:
      !latestInstruction && !input.isBlockedWithoutInstruction,
    canRequestReturn: latestInstruction?.state === "settled",
    canRetryInstruction:
      latestInstruction?.state === "failed" ||
      latestInstruction?.state === "returned",
    canSubmitInstruction: latestInstruction?.state === "prepared",
    canVoidInstruction:
      latestInstruction?.state === "prepared" ||
      latestInstruction?.state === "submitted",
  };
}

function getInstructionStatus(input: {
  isBlockedWithoutInstruction: boolean;
  latestInstruction: TreasuryInstruction | null;
}) {
  if (input.latestInstruction) {
    return input.latestInstruction.state;
  }

  if (input.isBlockedWithoutInstruction) {
    return "blocked" as const;
  }

  return "planned" as const;
}

function getAvailableOutcomeTransitions(
  latestInstruction: TreasuryInstruction | null,
): ("failed" | "returned" | "settled")[] {
  const submitTransitions: ("failed" | "returned" | "settled")[] = [
    "settled",
    "failed",
  ];
  const returnTransitions: ("failed" | "returned" | "settled")[] = ["returned"];

  if (!latestInstruction) {
    return [];
  }

  if (latestInstruction.state === "submitted") {
    return submitTransitions;
  }

  if (latestInstruction.state === "return_requested") {
    return returnTransitions;
  }

  return [];
}

function buildCrmWorkbenchEditability(workflow: DealWorkflowProjection) {
  return {
    agreement: workflow.summary.status === "draft",
    assignee: true,
    header: !isDealInTerminalStatus(workflow),
  };
}

function classifyCrmBoardStage(workflow: DealWorkflowProjection): {
  blockingReasons: string[];
  stage: CrmDealBoardStage;
} {
  const blockingReasons = collectBlockingReasons(workflow);

  if (workflow.summary.status === "draft") {
    return { blockingReasons, stage: "drafts" };
  }

  if (
    workflow.nextAction === "Accept calculation" ||
    workflow.nextAction === "Create calculation from route" ||
    workflow.nextAction === "Compose route"
  ) {
    return { blockingReasons, stage: "pricing" };
  }

  if (
    workflow.executionPlan.some((leg) => leg.state === "blocked") ||
    workflow.operationalState.positions.some(
      (position) => position.state === "blocked",
    )
  ) {
    return { blockingReasons, stage: "execution_blocked" };
  }

  if (
    workflow.nextAction === "Prepare documents" ||
    workflow.nextAction === "Prepare closing documents" ||
    workflow.nextAction === "Reconcile and close" ||
    workflow.summary.status === "reconciling"
  ) {
    return { blockingReasons, stage: "documents" };
  }

  return { blockingReasons, stage: "active" };
}

function requiresCustomerAttachment(nextAction: string) {
  return (
    nextAction === "Prepare documents" ||
    nextAction === "Prepare closing documents"
  );
}

function mapPortalNextAction(input: {
  hasRequiredInvoice: boolean;
  nextAction: string;
}) {
  if (requiresCustomerAttachment(input.nextAction)) {
    if (!input.hasRequiredInvoice) {
      return CUSTOMER_SAFE_INVOICE_REQUIRED_ACTION;
    }

    return "Ожидайте обработки документов";
  }

  const nextAction = input.nextAction;
  switch (nextAction) {
    case "Complete deal header":
      return "Заполните обязательные поля заявки";
    case "Accept calculation":
      return "Ожидайте или подтвердите расчет";
    case "Collect customer approval":
      return "Подтвердите условия сделки";
    case "Create calculation from route":
      return "Ожидайте расчет по маршруту";
    default:
      return nextAction;
  }
}

function buildPortalRequiredActions(input: {
  hasRequiredInvoice: boolean;
  nextAction: string;
  submissionCompleteness: {
    blockingReasons: string[];
    complete: boolean;
  };
}) {
  const actions = new Set<string>();

  for (const blocker of input.submissionCompleteness.blockingReasons) {
    actions.add(blocker);
  }

  if (
    requiresCustomerAttachment(input.nextAction) &&
    !input.hasRequiredInvoice
  ) {
    actions.add(CUSTOMER_SAFE_INVOICE_REQUIRED_ACTION);
  } else if (input.nextAction.trim().length > 0) {
    actions.add(
      mapPortalNextAction({
        hasRequiredInvoice: input.hasRequiredInvoice,
        nextAction: input.nextAction,
      }),
    );
  }

  return Array.from(actions);
}

function toPortalHeaderSummary(workflow: DealWorkflowProjection) {
  return {
    contractNumber: workflow.header.incomingReceipt.contractNumber,
    customerNote: workflow.header.common.customerNote,
    expectedAmount: workflow.header.incomingReceipt.expectedAmount,
    expectedCurrencyId: workflow.header.incomingReceipt.expectedCurrencyId,
    invoiceNumber: workflow.header.incomingReceipt.invoiceNumber,
    purpose: workflow.header.moneyRequest.purpose,
    requestedExecutionDate: workflow.header.common.requestedExecutionDate,
    sourceAmount: workflow.header.moneyRequest.sourceAmount,
    sourceCurrencyId: workflow.header.moneyRequest.sourceCurrencyId,
    targetCurrencyId: workflow.header.moneyRequest.targetCurrencyId,
  };
}

function buildPortalProjection(input: {
  attachments: Awaited<
    ReturnType<FilesModule["files"]["queries"]["listDealAttachments"]>
  >;
  calculationSummary: Awaited<ReturnType<typeof buildPortalCalculationSummary>>;
  workflow: DealWorkflowProjection;
}): PortalDealProjection {
  const customerSafeTimeline = getCustomerSafeTimeline(input.workflow.timeline);
  const attachments = buildCustomerSafeAttachments(
    input.attachments,
    input.workflow,
  );
  const hasRequiredInvoice =
    input.workflow.summary.type !== "payment" ||
    attachments.some((attachment) => attachment.purpose === "invoice");
  const submissionCompleteness = buildPortalSubmissionCompleteness({
    attachments: input.attachments,
    workflow: input.workflow,
  });

  return {
    attachments,
    calculationSummary: input.calculationSummary,
    customerSafeHeader: toPortalHeaderSummary(input.workflow),
    nextAction: mapPortalNextAction({
      hasRequiredInvoice,
      nextAction: input.workflow.nextAction,
    }),
    quoteSummary: buildPortalQuoteSummary(input.workflow),
    requiredActions: buildPortalRequiredActions({
      hasRequiredInvoice,
      nextAction: input.workflow.nextAction,
      submissionCompleteness,
    }),
    submissionCompleteness,
    summary: {
      applicantDisplayName:
        getApplicantParticipant(input.workflow)?.displayName ?? null,
      createdAt: input.workflow.summary.createdAt,
      id: input.workflow.summary.id,
      status: input.workflow.summary.status,
      type: input.workflow.summary.type,
    },
    timeline: customerSafeTimeline,
  };
}

function toPortalListItem(projection: PortalDealProjection) {
  return {
    applicantDisplayName: projection.summary.applicantDisplayName,
    attachmentCount: projection.attachments.length,
    calculationSummary: projection.calculationSummary,
    createdAt: projection.summary.createdAt,
    id: projection.summary.id,
    nextAction: projection.nextAction,
    quoteExpiresAt: projection.quoteSummary?.expiresAt ?? null,
    status: projection.summary.status,
    submissionComplete: projection.submissionCompleteness.complete,
    type: projection.summary.type,
  };
}

function isDealOwnedByCustomer(
  workflow: DealWorkflowProjection,
  customerId: string,
) {
  return getCustomerParticipant(workflow)?.customerId === customerId;
}

function toCrmDealCustomerContext(
  customer: Customer,
  counterparties: Counterparty[],
): CrmDealCustomerContext {
  return {
    counterparties,
    customer,
  };
}

function isQuoteEligible(workflow: DealWorkflowProjection) {
  return workflow.executionPlan.some((leg) => leg.kind === "convert");
}

function buildFundingMessage(workflow: DealWorkflowProjection) {
  if (!workflow.executionPlan.some((leg) => leg.kind === "convert")) {
    return null;
  }

  if (
    workflow.fundingResolution.state === "resolved" &&
    workflow.fundingResolution.strategy === "existing_inventory"
  ) {
    const targetCurrency =
      workflow.fundingResolution.targetCurrency ?? "целевой валюте";

    return `Используем остаток ${targetCurrency} на казначейском счете`;
  }

  if (
    workflow.fundingResolution.state === "resolved" &&
    workflow.fundingResolution.strategy === "external_fx"
  ) {
    return "Требуется конвертация";
  }

  return null;
}

function buildFinanceQuoteRequestContext(workflow: DealWorkflowProjection) {
  if (workflow.summary.type === "payment") {
    return {
      fundingMessage: buildFundingMessage(workflow),
      fundingResolution: workflow.fundingResolution,
      quoteAmount: workflow.header.incomingReceipt.expectedAmount ?? null,
      quoteAmountSide: "target" as const,
      sourceCurrencyId: workflow.header.moneyRequest.sourceCurrencyId ?? null,
      targetCurrencyId: workflow.header.moneyRequest.targetCurrencyId ?? null,
    };
  }

  return {
    fundingMessage: buildFundingMessage(workflow),
    fundingResolution: workflow.fundingResolution,
    quoteAmount: workflow.header.moneyRequest.sourceAmount ?? null,
    quoteAmountSide: "source" as const,
    sourceCurrencyId: workflow.header.moneyRequest.sourceCurrencyId ?? null,
    targetCurrencyId: workflow.header.moneyRequest.targetCurrencyId ?? null,
  };
}

function resolveAdjustmentDocumentDocType(input: {
  operationKind: TreasuryOperationKind | null;
}) {
  if (!input.operationKind || input.operationKind === "fx_conversion") {
    return null;
  }

  return "transfer_resolution";
}

function getPositionByKind(
  workflow: DealWorkflowProjection,
  kind: string,
): DealOperationalPosition | null {
  return (
    workflow.operationalState.positions.find(
      (position) => position.kind === kind,
    ) ?? null
  );
}

function sumCalculationLineAmountsByCurrency(
  lines: CalculationDetailsLike["lines"],
  kind: string,
) {
  return lines.reduce((acc, line) => {
    if (line.kind !== kind) {
      return acc;
    }

    const nextAmount =
      (acc.get(line.currencyId) ?? 0n) + BigInt(line.amountMinor);

    acc.set(line.currencyId, nextAmount);
    return acc;
  }, new Map<string, bigint>());
}

function addAmountByCurrency(
  amounts: Map<string, bigint>,
  currencyId: string | null | undefined,
  amountMinor: bigint | null | undefined,
) {
  if (!currencyId || amountMinor === null || amountMinor === undefined) {
    return;
  }

  amounts.set(currencyId, (amounts.get(currencyId) ?? 0n) + amountMinor);
}

function subtractProfitabilityAmountsByCurrency(
  base: Map<string, bigint>,
  ...groups: Map<string, bigint>[]
) {
  const totals = new Map(base);

  for (const group of groups) {
    for (const [currencyId, amountMinor] of group.entries()) {
      totals.set(currencyId, (totals.get(currencyId) ?? 0n) - amountMinor);
    }
  }

  return totals;
}

function mergeProfitabilityAmountsByCurrency(...groups: Map<string, bigint>[]) {
  const totals = new Map<string, bigint>();

  for (const group of groups) {
    for (const [currencyId, amountMinor] of group.entries()) {
      totals.set(currencyId, (totals.get(currencyId) ?? 0n) + amountMinor);
    }
  }

  return totals;
}

function parseProfitabilityClassification(
  value: unknown,
): "revenue" | "expense" | "pass_through" | "adjustment" | null {
  return value === "revenue" ||
    value === "expense" ||
    value === "pass_through" ||
    value === "adjustment"
    ? value
    : null;
}

function normalizeProfitabilityFamily(
  value: unknown,
  classification: "revenue" | "expense" | "pass_through" | "adjustment",
) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  switch (classification) {
    case "revenue":
      return "realized_revenue";
    case "pass_through":
      return "pass_through";
    case "adjustment":
      return "adjustment";
    default:
      return "provider_fee";
  }
}

function buildProfitabilityFamilyKey(input: {
  classification: "revenue" | "expense" | "pass_through" | "adjustment";
  family: string;
}) {
  return `${input.classification}:${input.family}`;
}

function sumCalculationAmountsByClassificationAndFamily(
  lines: CalculationDetailsLike["lines"],
) {
  const totals = new Map<string, Map<string, bigint>>();

  for (const line of lines) {
    const classification = parseProfitabilityClassification(line.classification);

    if (!classification) {
      continue;
    }

    const family = normalizeProfitabilityFamily(
      line.componentFamily,
      classification,
    );
    const key = buildProfitabilityFamilyKey({ classification, family });
    const bucket = totals.get(key) ?? new Map<string, bigint>();

    bucket.set(line.currencyId, (bucket.get(line.currencyId) ?? 0n) + BigInt(line.amountMinor));
    totals.set(key, bucket);
  }

  return totals;
}

function sumCalculationAmountsByClassification(
  lines: CalculationDetailsLike["lines"],
  classification: "revenue" | "expense" | "pass_through" | "adjustment",
) {
  const totals = new Map<string, bigint>();

  for (const line of lines) {
    if (line.classification !== classification) {
      continue;
    }

    totals.set(
      line.currencyId,
      (totals.get(line.currencyId) ?? 0n) + BigInt(line.amountMinor),
    );
  }

  return totals;
}

type DealExecutionActuals = {
  cashMovements: TreasuryCashMovement[];
  fees: TreasuryExecutionFee[];
  fills: TreasuryExecutionFill[];
};

function getExecutionActualCount(actuals: DealExecutionActuals) {
  return (
    actuals.fills.length +
    actuals.fees.length +
    actuals.cashMovements.length
  );
}

function getOperationIdsWithExecutionActuals(actuals: DealExecutionActuals) {
  return new Set(
    [
      ...actuals.fills.map((fill) => fill.operationId),
      ...actuals.fees.map((fee) => fee.operationId),
      ...actuals.cashMovements.map((movement) => movement.operationId),
    ].filter((operationId): operationId is string => Boolean(operationId)),
  );
}

function sumExecutionActualAmountsByClassificationAndFamily(
  actuals: DealExecutionActuals,
) {
  const totals = new Map<string, Map<string, bigint>>();

  for (const fill of actuals.fills) {
    const metadata =
      fill.metadata && typeof fill.metadata === "object" ? fill.metadata : null;
    const explicitClassification = parseProfitabilityClassification(
      metadata?.classification,
    );
    const explicitFamily = metadata?.componentFamily;

    if (
      fill.soldAmountMinor &&
      fill.soldCurrencyId &&
      explicitClassification
    ) {
      const family = normalizeProfitabilityFamily(
        explicitFamily,
        explicitClassification,
      );
      const key = buildProfitabilityFamilyKey({
        classification: explicitClassification,
        family,
      });
      const bucket = totals.get(key) ?? new Map<string, bigint>();

      addAmountByCurrency(
        bucket,
        fill.soldCurrencyId,
        BigInt(fill.soldAmountMinor),
      );
      totals.set(key, bucket);
    }
  }

  for (const fee of actuals.fees) {
    if (!fee.amountMinor || !fee.currencyId) {
      continue;
    }

    const metadata =
      fee.metadata && typeof fee.metadata === "object" ? fee.metadata : null;
    const classification =
      parseProfitabilityClassification(metadata?.classification) ?? "expense";
    const family = normalizeProfitabilityFamily(
      fee.feeFamily || metadata?.componentFamily,
      classification,
    );
    const key = buildProfitabilityFamilyKey({ classification, family });
    const bucket = totals.get(key) ?? new Map<string, bigint>();

    addAmountByCurrency(bucket, fee.currencyId, BigInt(fee.amountMinor));
    totals.set(key, bucket);
  }

  return totals;
}

function collectExecutionActualsByRouteLeg(actuals: DealExecutionActuals) {
  const actualByLeg = new Map<
    string,
    {
      feeTotals: Map<string, bigint>;
      fromTotals: Map<string, bigint>;
      toTotals: Map<string, bigint>;
    }
  >();

  for (const fill of actuals.fills) {
    if (!fill.routeLegId) {
      continue;
    }

    const bucket = actualByLeg.get(fill.routeLegId) ?? {
      feeTotals: new Map<string, bigint>(),
      fromTotals: new Map<string, bigint>(),
      toTotals: new Map<string, bigint>(),
    };

    if (fill.soldAmountMinor && fill.soldCurrencyId) {
      addAmountByCurrency(
        bucket.fromTotals,
        fill.soldCurrencyId,
        BigInt(fill.soldAmountMinor),
      );
    }

    if (fill.boughtAmountMinor && fill.boughtCurrencyId) {
      addAmountByCurrency(
        bucket.toTotals,
        fill.boughtCurrencyId,
        BigInt(fill.boughtAmountMinor),
      );
    }

    actualByLeg.set(fill.routeLegId, bucket);
  }

  for (const fee of actuals.fees) {
    if (!fee.routeLegId || !fee.amountMinor || !fee.currencyId) {
      continue;
    }

    const bucket = actualByLeg.get(fee.routeLegId) ?? {
      feeTotals: new Map<string, bigint>(),
      fromTotals: new Map<string, bigint>(),
      toTotals: new Map<string, bigint>(),
    };

    addAmountByCurrency(
      bucket.feeTotals,
      fee.currencyId,
      BigInt(fee.amountMinor),
    );
    actualByLeg.set(fee.routeLegId, bucket);
  }

  return actualByLeg;
}

async function listDealExecutionActuals(input: {
  dealId: string;
  deps: Pick<DealProjectionsWorkflowDeps, "treasury">;
}) {
  const { dealId, deps } = input;

  const [fills, fees, cashMovements] = await Promise.all([
    deps.treasury.operations.queries.listExecutionFills({
      dealId,
      limit: MAX_QUERY_LIST_LIMIT,
      offset: 0,
      sortBy: "executedAt",
      sortOrder: "desc",
    }),
    deps.treasury.operations.queries.listExecutionFees({
      dealId,
      limit: MAX_QUERY_LIST_LIMIT,
      offset: 0,
      sortBy: "chargedAt",
      sortOrder: "desc",
    }),
    deps.treasury.operations.queries.listCashMovements({
      dealId,
      limit: MAX_QUERY_LIST_LIMIT,
      offset: 0,
      sortBy: "bookedAt",
      sortOrder: "desc",
    }),
  ]);

  return {
    cashMovements: cashMovements.data,
    fees: fees.data,
    fills: fills.data,
  } satisfies DealExecutionActuals;
}

function mergeProfitabilityFamiliesByClassification(
  groups: Map<string, Map<string, bigint>>,
  classification: "revenue" | "expense" | "pass_through" | "adjustment",
) {
  const totals = new Map<string, bigint>();

  for (const [key, group] of groups.entries()) {
    if (!key.startsWith(`${classification}:`)) {
      continue;
    }

    for (const [currencyId, amountMinor] of group.entries()) {
      totals.set(currencyId, (totals.get(currencyId) ?? 0n) + amountMinor);
    }
  }

  return totals;
}

type RouteVarianceLegSnapshot = {
  code: string;
  expectedFromAmountMinor: string | null;
  expectedToAmountMinor: string | null;
  fromCurrencyId: string;
  id: string;
  idx: number;
  kind: string;
  toCurrencyId: string;
};

function isRouteVarianceLegSnapshot(
  value: unknown,
): value is RouteVarianceLegSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.code === "string" &&
    typeof candidate.fromCurrencyId === "string" &&
    typeof candidate.id === "string" &&
    typeof candidate.idx === "number" &&
    Number.isInteger(candidate.idx) &&
    typeof candidate.kind === "string" &&
    typeof candidate.toCurrencyId === "string" &&
    (typeof candidate.expectedFromAmountMinor === "string" ||
      candidate.expectedFromAmountMinor === null ||
      candidate.expectedFromAmountMinor === undefined) &&
    (typeof candidate.expectedToAmountMinor === "string" ||
      candidate.expectedToAmountMinor === null ||
      candidate.expectedToAmountMinor === undefined)
  );
}

function resolveRouteVersionSnapshot(snapshot: Record<string, unknown> | null): {
  legs: RouteVarianceLegSnapshot[];
} | null {
  if (!snapshot || !Array.isArray(snapshot.legs)) {
    return null;
  }

  const legs = snapshot.legs.filter(isRouteVarianceLegSnapshot);

  if (legs.length === 0) {
    return null;
  }

  return {
    legs: legs.map((leg) => ({
      code: leg.code,
      expectedFromAmountMinor: leg.expectedFromAmountMinor ?? null,
      expectedToAmountMinor: leg.expectedToAmountMinor ?? null,
      fromCurrencyId: leg.fromCurrencyId,
      id: leg.id,
      idx: leg.idx,
      kind: leg.kind,
      toCurrencyId: leg.toCurrencyId,
    })),
  };
}

async function resolveSingleProfitabilityAmount(
  currencyId: string | null,
  amountMinor: string | null,
  deps: Pick<DealProjectionsWorkflowDeps, "currencies">,
): Promise<FinanceProfitabilityAmount | null> {
  if (!currencyId || amountMinor === null) {
    return null;
  }

  const [amount] = await resolveProfitabilityAmounts(
    new Map([[currencyId, BigInt(amountMinor)]]),
    deps,
  );

  return amount ?? null;
}

function deriveProfitabilityCoverageState(input: {
  factCount: number;
  legsWithFacts: number;
  totalLegCount: number;
}) {
  if (input.factCount === 0) {
    return "not_started" as const;
  }

  if (input.totalLegCount > 0 && input.legsWithFacts >= input.totalLegCount) {
    return "complete" as const;
  }

  return "partial" as const;
}

async function resolveProfitabilityAmounts(
  currencyIdsToAmounts: Map<string, bigint>,
  deps: Pick<DealProjectionsWorkflowDeps, "currencies">,
): Promise<FinanceProfitabilityAmount[]> {
  if (currencyIdsToAmounts.size === 0) {
    return [];
  }

  const currencies = await Promise.all(
    Array.from(currencyIdsToAmounts.keys()).map(async (currencyId) => ({
      currency: await resolveOptionalLookup(() => deps.currencies.findById(currencyId)),
      currencyId,
    })),
  );

  const codeById = new Map(
    currencies.map(({ currency, currencyId }) => [
      currencyId,
      currency?.code ?? currencyId,
    ]),
  );

  return Array.from(currencyIdsToAmounts.entries())
    .sort(([leftId], [rightId]) => {
      const leftCode = codeById.get(leftId) ?? leftId;
      const rightCode = codeById.get(rightId) ?? rightId;
      return leftCode.localeCompare(rightCode);
    })
    .map(([currencyId, amountMinor]) => ({
      amountMinor: amountMinor.toString(),
      currencyCode: codeById.get(currencyId) ?? currencyId,
      currencyId,
    }));
}

async function buildProfitabilitySnapshot(
  calculation: Awaited<
    ReturnType<CalculationsModule["calculations"]["queries"]["findById"]>
  > | null,
  deps: Pick<DealProjectionsWorkflowDeps, "currencies">,
): Promise<FinanceProfitabilitySnapshot> {
  if (!calculation) {
    return null;
  }

  const feeRevenue = sumCalculationLineAmountsByCurrency(
    calculation.lines,
    "fee_revenue",
  );
  const providerFeeExpense = sumCalculationLineAmountsByCurrency(
    calculation.lines,
    "provider_fee_expense",
  );
  const spreadRevenue = sumCalculationLineAmountsByCurrency(
    calculation.lines,
    "spread_revenue",
  );
  const totalRevenue = mergeProfitabilityAmountsByCurrency(
    feeRevenue,
    spreadRevenue,
  );

  return {
    calculationId: calculation.id,
    feeRevenue: await resolveProfitabilityAmounts(feeRevenue, deps),
    providerFeeExpense: await resolveProfitabilityAmounts(
      providerFeeExpense,
      deps,
    ),
    spreadRevenue: await resolveProfitabilityAmounts(spreadRevenue, deps),
    totalRevenue: await resolveProfitabilityAmounts(totalRevenue, deps),
  };
}

async function buildProfitabilityVarianceSnapshot(input: {
  calculation: Awaited<
    ReturnType<CalculationsModule["calculations"]["queries"]["findById"]>
  > | null;
  actuals: DealExecutionActuals;
  operationCount: number;
  terminalOperationCount: number;
  deps: Pick<DealProjectionsWorkflowDeps, "currencies">;
}): Promise<FinanceProfitabilityVarianceSnapshot> {
  const { actuals, calculation, deps, operationCount, terminalOperationCount } =
    input;

  if (!calculation) {
    return null;
  }

  const expectedByFamily = sumCalculationAmountsByClassificationAndFamily(
    calculation.lines,
  );
  const actualByFamily =
    sumExecutionActualAmountsByClassificationAndFamily(actuals);
  const expectedRevenue = sumCalculationAmountsByClassification(
    calculation.lines,
    "revenue",
  );
  const expectedExpense = sumCalculationAmountsByClassification(
    calculation.lines,
    "expense",
  );
  const expectedPassThrough = sumCalculationAmountsByClassification(
    calculation.lines,
    "pass_through",
  );
  const expectedAdjustment = sumCalculationAmountsByClassification(
    calculation.lines,
    "adjustment",
  );
  const actualRevenue = mergeProfitabilityFamiliesByClassification(
    actualByFamily,
    "revenue",
  );
  const actualExpense = mergeProfitabilityFamiliesByClassification(
    actualByFamily,
    "expense",
  );
  const actualPassThrough = mergeProfitabilityFamiliesByClassification(
    actualByFamily,
    "pass_through",
  );
  const actualAdjustment = mergeProfitabilityFamiliesByClassification(
    actualByFamily,
    "adjustment",
  );
  const expectedNetMargin = subtractProfitabilityAmountsByCurrency(
    mergeProfitabilityAmountsByCurrency(expectedRevenue, expectedAdjustment),
    expectedExpense,
    expectedPassThrough,
  );
  const realizedNetMargin = subtractProfitabilityAmountsByCurrency(
    mergeProfitabilityAmountsByCurrency(
      actualRevenue.size > 0 ? actualRevenue : expectedRevenue,
      actualAdjustment.size > 0 ? actualAdjustment : expectedAdjustment,
    ),
    actualExpense.size > 0 ? actualExpense : expectedExpense,
    actualPassThrough.size > 0 ? actualPassThrough : expectedPassThrough,
  );
  const familyKeys = Array.from(
    new Set([...expectedByFamily.keys(), ...actualByFamily.keys()]),
  ).sort((left, right) => left.localeCompare(right));
  const varianceByCostFamily = await Promise.all(
    familyKeys.map(async (key) => {
      const separatorIndex = key.indexOf(":");
      const classification = key.slice(
        0,
        separatorIndex,
      ) as "revenue" | "expense" | "pass_through" | "adjustment";
      const family = key.slice(separatorIndex + 1);
      const expected = expectedByFamily.get(key) ?? new Map<string, bigint>();
      const actual = actualByFamily.get(key) ?? new Map<string, bigint>();

      return {
        actual: await resolveProfitabilityAmounts(actual, deps),
        classification,
        expected: await resolveProfitabilityAmounts(expected, deps),
        family,
        variance: await resolveProfitabilityAmounts(
          subtractProfitabilityAmountsByCurrency(actual, expected),
          deps,
        ),
      };
    }),
  );

  const route = resolveRouteVersionSnapshot(
    calculation.currentSnapshot.routeSnapshot,
  );
  const actualsByLeg = collectExecutionActualsByRouteLeg(actuals);

  const routeLegs =
    route?.legs ??
    Array.from(
      new Set([
        ...calculation.lines
          .map((line) => line.routeLegId)
          .filter((routeLegId): routeLegId is string => Boolean(routeLegId)),
        ...actualsByLeg.keys(),
      ]),
    ).map((routeLegId, idx) => ({
      code: routeLegId,
      executionCounterpartyId: null,
      expectedFromAmountMinor: null,
      expectedRateDen: null,
      expectedRateNum: null,
      expectedToAmountMinor: null,
      fromCurrencyId: calculation.currentSnapshot.calculationCurrencyId,
      fromParticipantCode: "unknown",
      id: routeLegId,
      idx: idx + 1,
      kind: "adjustment",
      notes: null,
      settlementModel: "unknown",
      toCurrencyId: calculation.currentSnapshot.baseCurrencyId,
      toParticipantCode: "unknown",
    }));

  const varianceByLeg = await Promise.all(
    [...routeLegs]
      .sort((left, right) => left.idx - right.idx)
      .map(async (leg) => {
        const bucket = actualsByLeg.get(leg.id);
        const actualFromAmount =
          bucket?.fromTotals.get(leg.fromCurrencyId)?.toString() ?? null;
        const actualToAmount =
          bucket?.toTotals.get(leg.toCurrencyId)?.toString() ?? null;

        return {
          actualFees: await resolveProfitabilityAmounts(
            bucket?.feeTotals ?? new Map<string, bigint>(),
            deps,
          ),
          actualFrom: await resolveSingleProfitabilityAmount(
            leg.fromCurrencyId,
            actualFromAmount,
            deps,
          ),
          actualTo: await resolveSingleProfitabilityAmount(
            leg.toCurrencyId,
            actualToAmount,
            deps,
          ),
          code: leg.code,
          expectedFrom: await resolveSingleProfitabilityAmount(
            leg.fromCurrencyId,
            leg.expectedFromAmountMinor,
            deps,
          ),
          expectedTo: await resolveSingleProfitabilityAmount(
            leg.toCurrencyId,
            leg.expectedToAmountMinor,
            deps,
          ),
          idx: leg.idx,
          kind: leg.kind,
          routeLegId: leg.id,
          varianceFrom:
            actualFromAmount !== null && leg.expectedFromAmountMinor !== null
              ? await resolveSingleProfitabilityAmount(
                  leg.fromCurrencyId,
                  (
                    BigInt(actualFromAmount) -
                    BigInt(leg.expectedFromAmountMinor)
                  ).toString(),
                  deps,
                )
              : null,
          varianceTo:
            actualToAmount !== null && leg.expectedToAmountMinor !== null
              ? await resolveSingleProfitabilityAmount(
                  leg.toCurrencyId,
                  (
                    BigInt(actualToAmount) -
                    BigInt(leg.expectedToAmountMinor)
                  ).toString(),
                  deps,
                )
              : null,
        };
      }),
  );

  const totalLegCount =
    route?.legs.length ??
    new Set([
      ...calculation.lines
        .map((line) => line.routeLegId)
        .filter((routeLegId): routeLegId is string => Boolean(routeLegId)),
      ...actualsByLeg.keys(),
    ]).size;

  return {
    actualCoverage: {
      factCount: getExecutionActualCount(actuals),
      legsWithFacts: actualsByLeg.size,
      operationCount,
      state: deriveProfitabilityCoverageState({
        factCount: getExecutionActualCount(actuals),
        legsWithFacts: actualsByLeg.size,
        totalLegCount,
      }),
      terminalOperationCount,
      totalLegCount,
    },
    actualExpense: await resolveProfitabilityAmounts(actualExpense, deps),
    actualPassThrough: await resolveProfitabilityAmounts(
      actualPassThrough,
      deps,
    ),
    calculationId: calculation.id,
    expectedNetMargin: await resolveProfitabilityAmounts(
      expectedNetMargin,
      deps,
    ),
    netMarginVariance: await resolveProfitabilityAmounts(
      subtractProfitabilityAmountsByCurrency(
        realizedNetMargin,
        expectedNetMargin,
      ),
      deps,
    ),
    realizedNetMargin: await resolveProfitabilityAmounts(
      realizedNetMargin,
      deps,
    ),
    varianceByCostFamily,
    varianceByLeg,
  };
}

function summarizeExecutionPlan(workflow: DealWorkflowProjection) {
  return {
    blockedLegCount: workflow.executionPlan.filter(
      (leg) => leg.state === "blocked",
    ).length,
    doneLegCount: workflow.executionPlan.filter((leg) => leg.state === "done")
      .length,
    totalLegCount: workflow.executionPlan.length,
  };
}

function collectBlockingReasons(workflow: DealWorkflowProjection) {
  const messages = new Set<string>();

  for (const readiness of workflow.transitionReadiness) {
    for (const blocker of readiness.blockers) {
      messages.add(blocker.message);
    }
  }

  return Array.from(messages);
}

function classifyFinanceQueue(workflow: DealWorkflowProjection): {
  blockers: string[];
  queue: FinanceDealQueue;
  queueReason: string;
} {
  const downstreamBlocked =
    workflow.executionPlan.some(
      (leg) => DOWNSTREAM_LEG_KINDS.has(leg.kind) && leg.state === "blocked",
    ) ||
    workflow.operationalState.positions.some(
      (position) =>
        DOWNSTREAM_POSITION_KINDS.has(position.kind) &&
        position.state === "blocked",
    );

  if (downstreamBlocked) {
    return {
      blockers: collectBlockingReasons(workflow),
      queue: "failed_instruction",
      queueReason: "Сделка заблокирована на этапе исполнения",
    };
  }

  const customerReceivable = getPositionByKind(workflow, "customer_receivable");
  const downstreamReady = workflow.operationalState.positions.some(
    (position) =>
      DOWNSTREAM_POSITION_KINDS.has(position.kind) &&
      (position.state === "in_progress" || position.state === "ready"),
  );

  if (
    workflow.summary.status === "executing" ||
    workflow.summary.status === "partially_executed" ||
    workflow.summary.status === "executed" ||
    workflow.summary.status === "reconciling" ||
    downstreamReady
  ) {
    return {
      blockers: [],
      queue: "execution",
      queueReason: "Сделка ожидает исполнения",
    };
  }

  if (
    workflow.summary.status === "approved_for_execution" ||
    customerReceivable?.state === "ready" ||
    customerReceivable?.state === "in_progress"
  ) {
    return {
      blockers: [],
      queue: "funding",
      queueReason: "Сделка находится на этапе фондирования",
    };
  }

  return {
    blockers: collectBlockingReasons(workflow),
    queue: "funding",
    queueReason: "Сделка ожидает следующий шаг на этапе фондирования",
  };
}

function buildFinanceDealOperation(input: {
  latestInstruction: TreasuryInstruction | null;
  operation: TreasuryOperationRecord;
  queueBlocked: boolean;
}) {
  return {
    actions: getInstructionActions({
      isBlockedWithoutInstruction: input.queueBlocked,
      latestInstruction: input.latestInstruction,
    }),
    availableOutcomeTransitions: getAvailableOutcomeTransitions(
      input.latestInstruction,
    ),
    id: input.operation.id,
    instructionStatus: getInstructionStatus({
      isBlockedWithoutInstruction: input.queueBlocked,
      latestInstruction: input.latestInstruction,
    }),
    kind: input.operation.kind,
    latestInstruction: input.latestInstruction,
    operationHref: `/treasury/operations/${input.operation.id}`,
    sourceRef: input.operation.sourceRef,
    state: input.operation.state,
  };
}

function matchesTextFilter(
  value: string | null | undefined,
  filter: string | undefined,
) {
  if (!filter) {
    return true;
  }

  const normalizedValue = (value ?? "").toLowerCase();
  const normalizedFilter = filter.toLowerCase();
  return normalizedValue.includes(normalizedFilter);
}

export function createDealProjectionsWorkflow(
  deps: DealProjectionsWorkflowDeps,
) {
  async function getPortalDealProjection(dealId: string, customerId: string) {
    const workflow = await deps.deals.deals.queries.findWorkflowById(dealId);

    if (!workflow || !isDealOwnedByCustomer(workflow, customerId)) {
      return null;
    }

    const calculationId = workflow.summary.calculationId;
    const [attachments, calculation] = await Promise.all([
      deps.files.files.queries.listDealAttachments(dealId),
      calculationId
        ? resolveOptionalLookup(() =>
            deps.calculations.calculations.queries.findById(calculationId),
          )
        : Promise.resolve(null),
    ]);
    const calculationSummary = await buildPortalCalculationSummary({
      calculation,
      currencies: deps.currencies,
    });
    return buildPortalProjection({ attachments, calculationSummary, workflow });
  }

  async function listPortalDeals(
    customerId: string,
    limit = 20,
    offset = 0,
  ): Promise<PortalDealListProjection> {
    const deals = await deps.deals.deals.queries.list({
      customerId,
      limit,
      offset,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    const projections = await Promise.all(
      deals.data.map((deal) => getPortalDealProjection(deal.id, customerId)),
    );

    return {
      data: projections
        .filter(
          (projection): projection is PortalDealProjection =>
            projection !== null,
        )
        .map(toPortalListItem),
      limit: deals.limit,
      offset: deals.offset,
      total: deals.total,
    };
  }

  async function listAllDeals(input?: {
    customerId?: string;
  }): Promise<DealListRecord[]> {
    const deals: DealListRecord[] = [];
    let offset = 0;
    let total: number;

    do {
      const page = await deps.deals.deals.queries.list({
        customerId: input?.customerId,
        limit: MAX_QUERY_LIST_LIMIT,
        offset,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      deals.push(...page.data);
      total = page.total;
      offset += page.limit;
    } while (offset < total);

    return deals;
  }

  async function listCrmDeals(
    query: Partial<CrmDealsListQuery> = {},
  ): Promise<CrmDealsListProjection> {
    const normalizedQuery = CrmDealsListQuerySchema.parse(query);
    const requestedStatuses = parseOptionalSet(normalizedQuery.statuses);
    const requestedCurrencies = parseOptionalSet(normalizedQuery.currencies);
    const listedDeals = await listAllDeals({
      customerId: normalizedQuery.customerId,
    });

    const customerIds = [
      ...new Set(listedDeals.map((deal) => deal.customerId)),
    ];
    const agentIds = [
      ...new Set(
        listedDeals
          .map((deal) => deal.agentId)
          .filter((agentId): agentId is string => Boolean(agentId)),
      ),
    ];
    const [
      { baseCurrenciesById, calculationsById, currenciesById },
      customers,
      agentEntries,
    ] = await Promise.all([
      loadDealMoneyLookups(listedDeals, deps),
      deps.parties.customers.queries.listByIds(customerIds),
      Promise.all(
        agentIds.map(
          async (agentId): Promise<readonly [string, UserDetailsLike]> =>
            [agentId, await deps.iam.queries.findById(agentId)] as const,
        ),
      ),
    ]);

    const agentsById = toMap(agentEntries);
    const customersById = toMap(
      customers.map(
        (customer): readonly [string, CustomerListItemLike] =>
          [customer.id, customer] as const,
      ),
    );

    const enrichedDeals = listedDeals.map(
      (
        deal,
      ): CrmDealListItem & {
        agentId: string | null;
        amountInBaseMinor: bigint;
        amountMinor: bigint;
        createdAtDate: number;
      } => {
        const customer = customersById.get(deal.customerId) ?? null;
        const calculation = deal.calculationId
          ? (calculationsById.get(deal.calculationId) ?? null)
          : null;
        const sourceCurrency = deal.currencyId
          ? (currenciesById.get(deal.currencyId) ?? null)
          : null;
        const baseCurrency = calculation
          ? (baseCurrenciesById.get(
              calculation.currentSnapshot.baseCurrencyId,
            ) ?? null)
          : null;
        const agent = deal.agentId
          ? (agentsById.get(deal.agentId) ?? null)
          : null;
        const monetary = buildCrmDealMoneySummary({
          deal,
          calculation,
          sourceCurrency,
          baseCurrency,
        });
        const closedAt =
          ["closed", "cancelled", "rejected", "expired", "failed"].includes(
            deal.status,
          )
            ? deal.updatedAt.toISOString()
            : null;
        const comment =
          deal.comment ?? deal.intakeComment ?? deal.reason ?? undefined;

        return {
          agentId: deal.agentId,
          agentName: agent?.name ?? "",
          amount: monetary.amount,
          amountInBase: monetary.amountInBase,
          amountInBaseMinor: monetary.amountInBaseMinor,
          amountMinor: monetary.amountMinor,
          baseCurrencyCode: monetary.baseCurrencyCode,
          client: customer?.name ?? "—",
          clientId: deal.customerId,
          closedAt,
          comment,
          createdAt: deal.createdAt.toISOString(),
          createdAtDate: deal.createdAt.getTime(),
          currency: monetary.currencyCode,
          feePercentage: monetary.feePercentage,
          id: deal.id,
          status: deal.status,
          updatedAt: deal.updatedAt.toISOString(),
        };
      },
    );

    const filteredDeals = enrichedDeals.filter((deal) => {
      if (requestedStatuses && !requestedStatuses.has(deal.status)) {
        return false;
      }
      if (requestedCurrencies && !requestedCurrencies.has(deal.currency)) {
        return false;
      }
      if (normalizedQuery.agentId && deal.agentId !== normalizedQuery.agentId) {
        return false;
      }
      if (
        normalizedQuery.dateFrom &&
        deal.createdAtDate < normalizedQuery.dateFrom.getTime()
      ) {
        return false;
      }
      if (
        normalizedQuery.dateTo &&
        deal.createdAtDate > normalizedQuery.dateTo.getTime()
      ) {
        return false;
      }
      if (
        normalizedQuery.qClient &&
        !deal.client
          .toLowerCase()
          .includes(normalizedQuery.qClient.toLowerCase())
      ) {
        return false;
      }
      if (
        normalizedQuery.qComment &&
        !(deal.comment ?? "")
          .toLowerCase()
          .includes(normalizedQuery.qComment.toLowerCase())
      ) {
        return false;
      }

      return true;
    });

    filteredDeals.sort((left, right) => {
      const comparison = (() => {
        switch (normalizedQuery.sortBy) {
          case "id":
            return left.id.localeCompare(right.id);
          case "client":
            return compareNullableStrings(left.client, right.client);
          case "amount":
            return compareBigInt(left.amountMinor, right.amountMinor);
          case "amountInBase":
            return compareBigInt(
              left.amountInBaseMinor,
              right.amountInBaseMinor,
            );
          case "closedAt":
            return compareNullableDates(left.closedAt, right.closedAt);
          case "agentName":
            return compareNullableStrings(left.agentName, right.agentName);
          case "createdAt":
          default:
            return left.createdAtDate - right.createdAtDate;
        }
      })();

      return normalizedQuery.sortOrder === "asc" ? comparison : -comparison;
    });

    const pagedDeals = filteredDeals
      .slice(
        normalizedQuery.offset,
        normalizedQuery.offset + normalizedQuery.limit,
      )
      .map(
        ({
          agentId: _agentId,
          amountInBaseMinor: _amountInBaseMinor,
          amountMinor: _amountMinor,
          createdAtDate: _createdAtDate,
          ...deal
        }) => deal,
      );

    return {
      data: pagedDeals,
      limit: normalizedQuery.limit,
      offset: normalizedQuery.offset,
      total: filteredDeals.length,
    };
  }

  async function getCrmDealsStats(
    input: CrmDealsStatsQuery,
  ): Promise<CrmDealsStats> {
    const listedDeals = await listAllDeals();
    const currenciesById = await loadOptionalLookupMap(
      [
        ...new Set(
          listedDeals
            .map((deal) => deal.currencyId)
            .filter((currencyId): currencyId is string => Boolean(currencyId)),
        ),
      ],
      (currencyId) => deps.currencies.findById(currencyId),
    );
    const from = new Date(`${input.dateFrom}T00:00:00Z`);
    const to = new Date(`${input.dateTo}T23:59:59.999Z`);
    let totalCount = 0;
    let totalAmount = 0n;
    const byStatus: Record<string, number> = {};

    for (const deal of listedDeals) {
      if (deal.createdAt < from || deal.createdAt > to) {
        continue;
      }

      totalCount += 1;
      byStatus[deal.status] = (byStatus[deal.status] ?? 0) + 1;

      const currencyCode =
        (deal.currencyId
          ? currenciesById.get(deal.currencyId)?.code
          : undefined) ?? "RUB";
      totalAmount += BigInt(
        toMinorAmountString(deal.amount ?? "0", currencyCode),
      );
    }

    return {
      byStatus,
      totalAmount: totalAmount.toString(),
      totalCount,
    };
  }

  async function listCrmDealsByStatus(): Promise<CrmDealsByStatus> {
    const PENDING_STATUSES = [
      "awaiting_customer_approval",
      "awaiting_internal_approval",
      "approved_for_execution",
    ] as const;
    const IN_PROGRESS_STATUSES = [
      "draft",
      "pricing",
      "quoted",
      "executing",
      "partially_executed",
      "executed",
      "reconciling",
    ] as const;
    const DONE_STATUSES = [
      "closed",
      "cancelled",
      "rejected",
      "expired",
      "failed",
    ] as const;

    const listedDeals = await listAllDeals();
    const customerIds = [
      ...new Set(listedDeals.map((deal) => deal.customerId)),
    ];

    const [
      { baseCurrenciesById, calculationsById, currenciesById },
      customers,
    ] = await Promise.all([
      loadDealMoneyLookups(listedDeals, deps),
      deps.parties.customers.queries.listByIds(customerIds),
    ]);

    const customersById = toMap(
      customers.map(
        (customer): readonly [string, CustomerListItemLike] =>
          [customer.id, customer] as const,
      ),
    );

    function toDealItem(deal: DealListRecord): CrmDealByStatusItem {
      const comment =
        deal.comment ?? deal.intakeComment ?? deal.reason ?? undefined;
      const calculation = deal.calculationId
        ? (calculationsById.get(deal.calculationId) ?? null)
        : null;
      const sourceCurrency = deal.currencyId
        ? (currenciesById.get(deal.currencyId) ?? null)
        : null;
      const baseCurrency = calculation
        ? (baseCurrenciesById.get(calculation.currentSnapshot.baseCurrencyId) ??
          null)
        : null;
      const monetary = buildCrmDealMoneySummary({
        deal,
        calculation,
        sourceCurrency,
        baseCurrency,
      });

      return {
        amount: monetary.amount,
        amountInBase: monetary.amountInBase,
        baseCurrencyCode: monetary.baseCurrencyCode,
        client: customersById.get(deal.customerId)?.name ?? "—",
        createdAt: deal.createdAt.toISOString(),
        currency: monetary.currencyCode,
        id: deal.id,
        status: deal.status,
        ...(comment ? { comment } : {}),
      };
    }

    return {
      done: listedDeals
        .filter((deal) =>
          (DONE_STATUSES as readonly string[]).includes(deal.status),
        )
        .map(toDealItem),
      inProgress: listedDeals
        .filter((deal) =>
          (IN_PROGRESS_STATUSES as readonly string[]).includes(deal.status),
        )
        .map(toDealItem),
      pending: listedDeals
        .filter((deal) =>
          (PENDING_STATUSES as readonly string[]).includes(deal.status),
        )
        .map(toDealItem),
    };
  }

  async function listCrmDealsByDay(
    query: CrmDealsByDayQuery = {},
  ): Promise<CrmDealsByDayItem[]> {
    const listedDeals = await listAllDeals({ customerId: query.customerId });
    const requestedStatuses = parseOptionalSet(query.statuses);
    const requestedCurrencies = parseOptionalSet(query.currencies);
    const currenciesById = await loadOptionalLookupMap(
      [
        ...new Set(
          listedDeals
            .map((deal) => deal.currencyId)
            .filter((currencyId): currencyId is string => Boolean(currencyId)),
        ),
      ],
      (currencyId) => deps.currencies.findById(currencyId),
    );
    const precisionByCode = new Map(
      Array.from(currenciesById.values())
        .filter((currency): currency is NonNullable<typeof currency> =>
          Boolean(currency),
        )
        .map((currency) => [currency.code, currency.precision] as const),
    );

    const dayMap = new Map<
      string,
      {
        closedCount: number;
        count: number;
        date: string;
        totalsByCurrency: Map<string, bigint>;
        closedTotalsByCurrency: Map<string, bigint>;
      }
    >();

    for (const deal of listedDeals) {
      if (query.dateFrom && deal.createdAt < new Date(query.dateFrom)) {
        continue;
      }
      if (query.dateTo && deal.createdAt > new Date(query.dateTo)) {
        continue;
      }
      if (query.agentId && deal.agentId !== query.agentId) {
        continue;
      }
      if (requestedStatuses && !requestedStatuses.has(deal.status)) {
        continue;
      }

      const currencyCode =
        (deal.currencyId
          ? currenciesById.get(deal.currencyId)?.code
          : undefined) ?? "RUB";

      if (requestedCurrencies && !requestedCurrencies.has(currencyCode)) {
        continue;
      }

      const date = deal.createdAt.toISOString().slice(0, 10);
      const totalMinor = toMinorOrZero(deal.amount, currencyCode);

      if (!dayMap.has(date)) {
        dayMap.set(date, {
          closedCount: 0,
          count: 0,
          date,
          closedTotalsByCurrency: new Map<string, bigint>(),
          totalsByCurrency: new Map<string, bigint>(),
        });
      }

      const day = dayMap.get(date)!;
      day.count += 1;
      day.totalsByCurrency.set(
        currencyCode,
        (day.totalsByCurrency.get(currencyCode) ?? 0n) + totalMinor,
      );

      if (deal.status === "closed") {
        day.closedCount += 1;
        day.closedTotalsByCurrency.set(
          currencyCode,
          (day.closedTotalsByCurrency.get(currencyCode) ?? 0n) + totalMinor,
        );
      }
    }

    return Array.from(dayMap.values()).map((day) => {
      const totalsByCurrency = Array.from(day.totalsByCurrency.entries()).map(
        ([currencyCode, amountMinor]) => {
          return [
            currencyCode,
            parseMinorOrZero(
              amountMinor,
              precisionByCode.get(currencyCode) ?? 2,
            ),
          ] as const;
        },
      );
      const totalsObject = Object.fromEntries(totalsByCurrency);
      const reportCurrencyCode = query.reportCurrencyCode?.trim().toUpperCase();
      const amount = reportCurrencyCode
        ? ((totalsObject[reportCurrencyCode] as number | undefined) ?? 0)
        : totalsByCurrency.length === 1
          ? (totalsByCurrency[0]?.[1] ?? 0)
          : 0;
      const closedAmount = reportCurrencyCode
        ? parseMinorOrZero(
            day.closedTotalsByCurrency.get(reportCurrencyCode) ?? 0n,
            precisionByCode.get(reportCurrencyCode) ?? 2,
          )
        : day.closedTotalsByCurrency.size === 1
          ? parseMinorOrZero(
              Array.from(day.closedTotalsByCurrency.values())[0] ?? 0n,
              precisionByCode.get(
                Array.from(day.closedTotalsByCurrency.keys())[0] ?? "",
              ) ?? 2,
            )
          : 0;

      return {
        amount,
        closedAmount,
        closedCount: day.closedCount,
        count: day.count,
        date: day.date,
        ...totalsObject,
      };
    });
  }

  async function getCrmDealWorkbenchProjection(
    dealId: string,
  ): Promise<CrmDealWorkbenchProjection | null> {
    const [detail, workflow, attachments] = await Promise.all([
      deps.deals.deals.queries.findById(dealId),
      deps.deals.deals.queries.findWorkflowById(dealId),
      deps.files.files.queries.listDealAttachments(dealId),
    ]);

    if (!detail || !workflow) {
      return null;
    }

    const customerId = getCustomerParticipant(workflow)?.customerId ?? null;
    const applicantCounterpartyId =
      getApplicantParticipant(workflow)?.counterpartyId ??
      workflow.header.common.applicantCounterpartyId;
    const internalEntityOrganizationId =
      getInternalEntityParticipant(workflow)?.organizationId ?? null;

    const [
      agreement,
      applicant,
      calculationsHistory,
      customer,
      internalEntity,
    ] = await Promise.all([
      resolveOptionalLookup(() =>
        deps.agreements.agreements.queries.findById(workflow.summary.agreementId),
      ),
      applicantCounterpartyId
        ? resolveOptionalLookup(() =>
            deps.parties.counterparties.queries.findById(
              applicantCounterpartyId,
            ),
          )
        : Promise.resolve(null),
      deps.deals.deals.queries.listCalculationHistory(dealId),
      customerId
        ? resolveOptionalLookup(() =>
            deps.parties.customers.queries.findById(customerId),
          )
        : Promise.resolve(null),
      internalEntityOrganizationId
        ? resolveOptionalLookup(() =>
            deps.parties.organizations.queries.findById(
              internalEntityOrganizationId,
            ),
          )
        : Promise.resolve(null),
    ]);

    const currentCalculationId = workflow.summary.calculationId;
    const [
      legalEntitiesResult,
      currentCalculation,
      internalEntityRequisite,
      executionActuals,
      operationsResult,
      quotesResult,
    ] = await Promise.all([
      customerId
        ? (async () => {
            const result = await deps.parties.counterparties.queries.list({
              customerId,
              limit: MAX_QUERY_LIST_LIMIT,
              offset: 0,
              sortBy: "createdAt",
              sortOrder: "desc",
            });
            const data = (
              await Promise.all(
                result.data.map((item) =>
                  resolveOptionalLookup(() =>
                    deps.parties.counterparties.queries.findById(item.id),
                  ),
                ),
              )
            ).filter((item): item is Counterparty => item !== null);

            return { ...result, data };
          })()
        : Promise.resolve(null),
      currentCalculationId
        ? resolveOptionalLookup(() =>
            deps.calculations.calculations.queries.findById(
              currentCalculationId,
            ),
          )
        : Promise.resolve(null),
      agreement?.organizationRequisiteId
        ? resolveOptionalLookup(() =>
            deps.parties.requisites.queries.findById(
              agreement.organizationRequisiteId,
            ),
          )
        : Promise.resolve(null),
      listDealExecutionActuals({ dealId, deps }),
      deps.treasury.operations.queries.list({
        dealId,
        limit: MAX_QUERY_LIST_LIMIT,
        offset: 0,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
      deps.treasury.quotes.queries.listQuotes({
        dealId,
        limit: MAX_QUERY_LIST_LIMIT,
        offset: 0,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
    ]);

    const internalEntityRequisiteProvider = internalEntityRequisite?.providerId
      ? await resolveOptionalLookup(() =>
          deps.parties.requisites.queries.findProviderById(
            internalEntityRequisite.providerId,
          ),
        )
      : null;
    const currentCalculationSummary = await buildPortalCalculationSummary({
      calculation: currentCalculation,
      currencies: deps.currencies,
    });
    const latestInstructions =
      operationsResult.data.length > 0
        ? await deps.treasury.instructions.queries.listLatestByOperationIds(
            operationsResult.data.map((operation) => operation.id),
          )
        : [];
    const operationsById = new Map(
      operationsResult.data.map((operation) => [operation.id, operation] as const),
    );
    const latestInstructionByOperationId = new Map(
      latestInstructions.map(
        (instruction) => [instruction.operationId, instruction] as const,
      ),
    );
    const reconciliationLinks =
      operationsResult.data.length > 0
        ? await deps.reconciliation.links.listOperationLinks({
            operationIds: operationsResult.data.map((operation) => operation.id),
          })
        : [];
    const reconciliationLinksByOperationId = new Map(
      reconciliationLinks.map(
        (link): readonly [string, ReconciliationOperationLinkDto] => [
          link.operationId,
          link,
        ],
      ),
    );
    const {
      instructionSummary,
      reconciliationExceptions: readinessReconciliationExceptions,
      reconciliationSummary,
    } = deriveFinanceDealReadiness({
      latestInstructionByOperationId,
      operationIdsWithFacts: getOperationIdsWithExecutionActuals(
        executionActuals,
      ),
      profitabilityCalculationId: currentCalculation?.id ?? null,
      reconciliationLinksByOperationId,
      workflow,
    });
    const reconciliationExceptions = readinessReconciliationExceptions.map(
      (exception) => ({
        ...exception,
        actions: {
          adjustmentDocumentDocType: resolveAdjustmentDocumentDocType({
            operationKind:
              operationsById.get(exception.operationId)?.kind ?? null,
          }),
          canIgnore: exception.state === "open",
        },
      }),
    );

    const actions = buildCrmWorkbenchActions(workflow);
    const editability = buildCrmWorkbenchEditability(workflow);
    const evidenceRequirements = buildCrmEvidenceRequirements({
      attachments,
      workflow,
    });
    const beneficiaryDraft = buildCrmBeneficiaryDraft({
      attachments,
      workflow,
    });
    const documentRequirements = buildCrmDocumentRequirements(workflow);

    return {
      acceptedCalculation: workflow.acceptedCalculation,
      actions,
      approvals: detail.approvals,
      assignee: {
        userId: workflow.summary.agentId,
      },
      attachmentIngestions: workflow.attachmentIngestions,
      beneficiaryDraft,
      comment: detail.comment,
      context: {
        agreement,
        applicant,
        customer:
          customer && legalEntitiesResult
            ? toCrmDealCustomerContext(customer, legalEntitiesResult.data)
            : null,
        internalEntity,
        internalEntityRequisite,
        internalEntityRequisiteProvider,
      },
      documentRequirements,
      editability,
      evidenceRequirements,
      executionPlan: workflow.executionPlan,
      header: workflow.header,
      nextAction: workflow.nextAction,
      operationalState: workflow.operationalState,
      participants: workflow.participants,
      pricing: {
        calculationHistory: calculationsHistory,
        currentCalculation: currentCalculationSummary,
        quoteEligibility: isQuoteEligible(workflow),
        quotes: quotesResult.data.map(serializeCrmPricingQuote),
      },
      profitabilitySnapshot: await buildProfitabilitySnapshot(
        currentCalculation,
        deps,
      ),
      profitabilityVariance: await buildProfitabilityVarianceSnapshot({
        calculation: currentCalculation,
        deps,
        actuals: executionActuals,
        operationCount: operationsResult.total,
        terminalOperationCount: instructionSummary.terminalOperations,
      }),
      reconciliationSummary,
      revision: workflow.revision,
      relatedResources: {
        attachments,
        formalDocuments: workflow.relatedResources.formalDocuments,
        reconciliationExceptions,
      },
      sectionCompleteness: workflow.sectionCompleteness,
      summary: {
        ...workflow.summary,
        applicantDisplayName:
          getApplicantParticipant(workflow)?.displayName ?? null,
        customerDisplayName: customer?.name ?? null,
        internalEntityDisplayName:
          getInternalEntityParticipant(workflow)?.displayName ??
          internalEntity?.shortName ??
          null,
      },
      timeline: workflow.timeline,
      transitionReadiness: workflow.transitionReadiness,
    };
  }

  async function listCrmDealBoard(): Promise<CrmDealBoardProjection> {
    const listedDeals = await deps.deals.deals.queries.list({
      limit: MAX_QUERY_LIST_LIMIT,
      offset: 0,
      sortBy: "updatedAt",
      sortOrder: "desc",
    });

    const items = await Promise.all(
      listedDeals.data.map(async (deal) => {
        const [workflow, attachments] = await Promise.all([
          deps.deals.deals.queries.findWorkflowById(deal.id),
          deps.files.files.queries.listDealAttachments(deal.id),
        ]);

        if (!workflow) {
          return null;
        }

        const customerId = getCustomerParticipant(workflow)?.customerId ?? null;
        const customer = customerId
          ? await resolveOptionalLookup(() =>
              deps.parties.customers.queries.findById(customerId),
            )
          : null;
        const stageContext = classifyCrmBoardStage(workflow);

        return {
          applicantName: getApplicantParticipant(workflow)?.displayName ?? null,
          assigneeUserId: workflow.summary.agentId,
          blockingReasons: stageContext.blockingReasons,
          customerName: customer?.name ?? null,
          documentSummary: {
            attachmentCount: attachments.length,
            formalDocumentCount:
              workflow.relatedResources.formalDocuments.length,
          },
          id: workflow.summary.id,
          nextAction: workflow.nextAction,
          quoteSummary: buildPortalQuoteSummary(workflow),
          stage: stageContext.stage,
          status: workflow.summary.status,
          type: workflow.summary.type,
          updatedAt: workflow.summary.updatedAt,
        };
      }),
    );

    const data = items.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    );
    const counts = data.reduce(
      (acc, item) => {
        acc[item.stage] += 1;
        return acc;
      },
      {
        active: 0,
        documents: 0,
        drafts: 0,
        execution_blocked: 0,
        pricing: 0,
      },
    );

    return {
      counts,
      items: data,
    };
  }

  async function getFinanceDealWorkspaceProjection(
    dealId: string,
  ): Promise<FinanceDealWorkspaceProjection | null> {
    const workflow = await deps.deals.deals.queries.findWorkflowById(dealId);

    if (!workflow) {
      return null;
    }

    const currentCalculationId = workflow.summary.calculationId;
    const [
      attachments,
      currentCalculation,
      currentRoute,
      executionActuals,
      operationsResult,
      quotesResult,
    ] = await Promise.all([
      deps.files.files.queries.listDealAttachments(dealId),
      currentCalculationId
        ? resolveOptionalLookup(() =>
            deps.calculations.calculations.queries.findById(
              currentCalculationId,
            ),
          )
        : Promise.resolve(null),
      deps.deals.deals.queries.findCurrentRouteByDealId?.(dealId) ??
        Promise.resolve(null),
      listDealExecutionActuals({ dealId, deps }),
      deps.treasury.operations.queries.list({
        dealId,
        limit: MAX_QUERY_LIST_LIMIT,
        offset: 0,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
      deps.treasury.quotes.queries.listQuotes({
        dealId,
        limit: MAX_QUERY_LIST_LIMIT,
        offset: 0,
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
    ]);

    const actions = buildCrmWorkbenchActions(workflow);
    const attachmentRequirements = buildCrmEvidenceRequirements({
      attachments,
      workflow,
    });
    const formalDocumentRequirements = buildCrmDocumentRequirements(workflow);
    const openingInvoiceRequirement =
      formalDocumentRequirements.find(
        (requirement) =>
          requirement.stage === "opening" && requirement.docType === "invoice",
      ) ?? null;
    const activeExchangeDocument =
      workflow.relatedResources.formalDocuments.find(
        (document) => document.docType === "exchange",
      ) ?? null;
    const queueContext = classifyFinanceQueue(workflow);
    const latestInstructions =
      await deps.treasury.instructions.queries.listLatestByOperationIds(
        operationsResult.data.map((operation) => operation.id),
      );
    const operationsById = new Map(
      operationsResult.data.map((operation) => [operation.id, operation] as const),
    );
    const latestInstructionByOperationId = new Map(
      latestInstructions.map(
        (instruction) => [instruction.operationId, instruction] as const,
      ),
    );
    const reconciliationLinks =
      await deps.reconciliation.links.listOperationLinks({
        operationIds: operationsResult.data.map((operation) => operation.id),
      });
    const reconciliationLinksByOperationId = new Map(
      reconciliationLinks.map(
        (link): readonly [string, ReconciliationOperationLinkDto] => [
          link.operationId,
          link,
        ],
      ),
    );
    const {
      closeReadiness,
      instructionSummary,
      reconciliationExceptions: readinessReconciliationExceptions,
      reconciliationSummary,
    } = deriveFinanceDealReadiness({
      latestInstructionByOperationId,
      operationIdsWithFacts: getOperationIdsWithExecutionActuals(
        executionActuals,
      ),
      profitabilityCalculationId: currentCalculation?.id ?? null,
      reconciliationLinksByOperationId,
      workflow,
    });
    const reconciliationExceptions = readinessReconciliationExceptions.map(
      (exception) => ({
        ...exception,
        actions: {
          adjustmentDocumentDocType: resolveAdjustmentDocumentDocType({
            operationKind:
              operationsById.get(exception.operationId)?.kind ?? null,
          }),
          canIgnore: exception.state === "open",
        },
      }),
    );
    const queueBlocked =
      queueContext.blockers.length > 0 ||
      workflow.executionPlan.some((leg) => leg.state === "blocked");
    const hasAnyMaterializedOperations = workflow.executionPlan.some(
      (leg) => leg.operationRefs.length > 0,
    );
    const hasAcceptedCalculation = workflow.acceptedCalculation !== null;
    const currentCalculationIsOffered =
      currentCalculation?.currentSnapshot.state === "offered" &&
      workflow.summary.calculationId === currentCalculation.id;
    const canRecordExecutionActuals =
      hasAcceptedCalculation &&
      hasAnyMaterializedOperations &&
      !isDealInTerminalStatus(workflow);

    return {
      acceptedCalculation: workflow.acceptedCalculation,
      actions: {
        canAcceptCalculation:
          currentCalculationIsOffered && !isDealInTerminalStatus(workflow),
        canCloseDeal: closeReadiness.ready,
        canCreateCalculation:
          currentRoute !== null &&
          workflow.summary.calculationId === null &&
          !isDealInTerminalStatus(workflow),
        canCreateQuote: false,
        canRecordCashMovement: canRecordExecutionActuals,
        canRecordExecutionFee: canRecordExecutionActuals,
        canRecordExecutionFill: canRecordExecutionActuals,
        canRequestExecution:
          !hasAnyMaterializedOperations && isExecutionRequestAllowed(workflow),
        canRunReconciliation:
          instructionSummary.totalOperations > 0 &&
          instructionSummary.terminalOperations ===
            instructionSummary.totalOperations &&
          (reconciliationSummary.state === "pending" ||
            reconciliationSummary.state === "blocked"),
        canResolveExecutionBlocker:
          workflow.executionPlan.some((leg) => leg.state === "blocked"),
        canSupersedeCalculation:
          hasAcceptedCalculation && !isDealInTerminalStatus(workflow),
        canUploadAttachment: actions.canUploadAttachment,
      },
      attachmentRequirements,
      closeReadiness,
      executionPlan: workflow.executionPlan.map((leg) => ({
        ...leg,
        actions: {
          canCreateLegOperation:
            hasAnyMaterializedOperations &&
            leg.operationRefs.length === 0 &&
            leg.state !== "blocked" &&
            leg.state !== "skipped" &&
            !isDealInTerminalStatus(workflow),
          exchangeDocument:
            leg.kind === "convert" &&
            workflow.fundingResolution.state === "resolved" &&
            workflow.fundingResolution.strategy === "external_fx" &&
            openingInvoiceRequirement
              ? {
                  activeDocumentId: activeExchangeDocument?.id ?? null,
                  createAllowed:
                    openingInvoiceRequirement.state === "ready" &&
                    Boolean(openingInvoiceRequirement.activeDocumentId) &&
                    Boolean(workflow.summary.calculationId) &&
                    !activeExchangeDocument &&
                    !isDealInTerminalStatus(workflow),
                  docType: "exchange",
                  openAllowed: Boolean(activeExchangeDocument),
                }
              : null,
        },
      })),
      formalDocumentRequirements,
      header: workflow.header,
      instructionSummary,
      nextAction: workflow.nextAction,
      operationalState: workflow.operationalState,
      pricing: {
        ...buildFinanceQuoteRequestContext(workflow),
        quoteEligibility: isQuoteEligible(workflow),
      },
      profitabilitySnapshot: await buildProfitabilitySnapshot(
        currentCalculation,
        deps,
      ),
      profitabilityVariance: await buildProfitabilityVarianceSnapshot({
        calculation: currentCalculation,
        deps,
        actuals: executionActuals,
        operationCount: operationsResult.total,
        terminalOperationCount: instructionSummary.terminalOperations,
      }),
      queueContext,
      reconciliationSummary,
      relatedResources: {
        attachments,
        formalDocuments: workflow.relatedResources.formalDocuments,
        operations: operationsResult.data.map((operation) =>
          buildFinanceDealOperation({
            latestInstruction:
              latestInstructionByOperationId.get(operation.id) ?? null,
            operation,
            queueBlocked,
          }),
        ),
        quotes: workflow.relatedResources.quotes,
        reconciliationExceptions,
      },
      summary: {
        ...workflow.summary,
        applicantDisplayName:
          getApplicantParticipant(workflow)?.displayName ?? null,
        internalEntityDisplayName:
          getInternalEntityParticipant(workflow)?.displayName ?? null,
      },
      timeline: workflow.timeline,
      workflow,
    };
  }

  async function listFinanceDealQueues(
    filters: ListFinanceDealQueuesInput = {},
  ): Promise<FinanceDealQueueProjection> {
    const listedDeals = await deps.deals.deals.queries.list({
      limit: MAX_QUERY_LIST_LIMIT,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
      status: filters.status,
      type: filters.type,
    });

    const queueItems = await Promise.all(
      listedDeals.data.map(
        async (deal): Promise<FinanceDealQueueItem | null> => {
          const workflow = await deps.deals.deals.queries.findWorkflowById(
            deal.id,
          );

          if (!workflow) {
            return null;
          }

          const customerId =
            getCustomerParticipant(workflow)?.customerId ?? null;
          const internalEntityName =
            getInternalEntityParticipant(workflow)?.displayName ?? null;

          const customer = customerId
            ? await resolveOptionalLookup(() =>
                deps.parties.customers.queries.findById(customerId),
              )
            : null;
          const applicantName =
            customer?.name ??
            getApplicantParticipant(workflow)?.displayName ??
            null;

          if (
            !matchesTextFilter(applicantName, filters.applicant) ||
            !matchesTextFilter(internalEntityName, filters.internalEntity)
          ) {
            return null;
          }

          const currentCalculationId = workflow.summary.calculationId;
          const [agreement, currentCalculation, executionActuals, operationsResult] = await Promise.all([
            resolveOptionalLookup(() =>
              deps.agreements.agreements.queries.findById(
                workflow.summary.agreementId,
              ),
            ),
            currentCalculationId
              ? resolveOptionalLookup(() =>
                  deps.calculations.calculations.queries.findById(
                    currentCalculationId,
                  ),
                )
              : Promise.resolve(null),
            listDealExecutionActuals({ dealId: deal.id, deps }),
            deps.treasury.operations.queries.list({
              dealId: deal.id,
              limit: MAX_QUERY_LIST_LIMIT,
              offset: 0,
              sortBy: "createdAt",
              sortOrder: "desc",
            }),
          ]);
          const queueContext = classifyFinanceQueue(workflow);
          const latestInstructions =
            await deps.treasury.instructions.queries.listLatestByOperationIds(
              operationsResult.data.map((operation) => operation.id),
            );
          const latestInstructionByOperationId = new Map(
            latestInstructions.map(
              (instruction) => [instruction.operationId, instruction] as const,
            ),
          );
          const reconciliationLinks =
            await deps.reconciliation.links.listOperationLinks({
              operationIds: operationsResult.data.map(
                (operation) => operation.id,
              ),
            });
          const reconciliationLinksByOperationId = new Map(
            reconciliationLinks.map(
              (link): readonly [string, ReconciliationOperationLinkDto] => [
                link.operationId,
                link,
              ],
            ),
          );
          const { closeReadiness, reconciliationSummary } =
            deriveFinanceDealReadiness({
              latestInstructionByOperationId,
              operationIdsWithFacts: getOperationIdsWithExecutionActuals(
                executionActuals,
              ),
              profitabilityCalculationId: currentCalculation?.id ?? null,
              reconciliationLinksByOperationId,
              workflow,
            });
          const { stage, stageReason } = deriveFinanceDealStage({
            agreementOrganizationId: agreement?.organizationId ?? null,
            closeReadiness,
            internalEntityOrganizationId:
              getInternalEntityParticipant(workflow)?.organizationId ?? null,
            latestInstructionByOperationId,
            reconciliationSummary,
            workflow,
          });

          const attachments =
            await deps.files.files.queries.listDealAttachments(deal.id);

          return {
            applicantName,
            blockingReasons: queueContext.blockers,
            createdAt: workflow.summary.createdAt,
            dealId: workflow.summary.id,
            documentSummary: {
              attachmentCount: attachments.length,
              formalDocumentCount:
                workflow.relatedResources.formalDocuments.length,
            },
            executionSummary: summarizeExecutionPlan(workflow),
            internalEntityName,
            nextAction: workflow.nextAction,
            operationalState: workflow.operationalState,
            profitabilitySnapshot: await buildProfitabilitySnapshot(
              currentCalculation,
              deps,
            ),
            queue: queueContext.queue,
            queueReason: queueContext.queueReason,
            stage,
            stageReason,
            quoteSummary: buildPortalQuoteSummary(workflow),
            status: workflow.summary.status,
            type: workflow.summary.type,
          };
        },
      ),
    );

    const filteredItems = queueItems.filter(
      (item): item is FinanceDealQueueItem => item !== null,
    );

    const counts = filteredItems.reduce(
      (acc, item) => {
        acc[item.queue] += 1;
        return acc;
      },
      {
        execution: 0,
        failed_instruction: 0,
        funding: 0,
      },
    );

    return {
      counts,
      filters,
      items: filteredItems.filter((item) => {
        if (filters.queue && item.queue !== filters.queue) {
          return false;
        }

        if (filters.stage && item.stage !== filters.stage) {
          return false;
        }

        return true;
      }),
    };
  }

  return {
    getCrmDealsStats,
    getPortalDealProjection,
    listCrmDeals,
    listCrmDealBoard,
    listCrmDealsByDay,
    listCrmDealsByStatus,
    getCrmDealWorkbenchProjection,
    getFinanceDealWorkspaceProjection,
    listFinanceDealQueues,
    listPortalDeals,
  };
}

export type DealProjectionsWorkflow = ReturnType<
  typeof createDealProjectionsWorkflow
>;
