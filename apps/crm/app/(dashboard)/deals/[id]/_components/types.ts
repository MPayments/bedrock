import type { Currency, CurrencyOption } from "@bedrock/currencies/contracts";
import type {
  DealBankInstructionSnapshot,
  DealCounterpartySnapshot,
  DealLegKind,
  DealLegState,
  DealOperationalPositionKind,
  DealOperationalPositionState,
  DealStatus,
  DealType,
  DealWorkflowProjection,
} from "@bedrock/deals/contracts";
import type {
  CrmDealBoardProjection,
  CrmDealWorkbenchProjection,
} from "@bedrock/workflow-deal-projections/contracts";

import type { AgreementFeeRuleView } from "@/lib/utils/agreement-fee-format";

type SerializedDates<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? SerializedDates<U>[]
    : T extends object
      ? { [K in keyof T]: SerializedDates<T[K]> }
      : T;

type SerializedDealWorkflowProjection = SerializedDates<DealWorkflowProjection>;
type SerializedCrmDealWorkbenchProjection =
  SerializedDates<CrmDealWorkbenchProjection>;

export type {
  DealLegKind,
  DealLegState,
  DealOperationalPositionKind,
  DealOperationalPositionState,
  DealStatus,
  DealType,
};

export type ApiAgreementDetails = NonNullable<
  SerializedCrmDealWorkbenchProjection["context"]["agreement"]
>;
export type ApiAgreementFeeRule =
  ApiAgreementDetails["currentVersion"]["feeRules"][number] &
    AgreementFeeRuleView;
export type ApiAttachment =
  SerializedCrmDealWorkbenchProjection["relatedResources"]["attachments"][number];
export type ApiCalculationSummary = NonNullable<
  SerializedCrmDealWorkbenchProjection["pricing"]["currentCalculation"]
>;
export type ApiCanonicalCounterparty = NonNullable<
  SerializedCrmDealWorkbenchProjection["context"]["applicant"]
>;
export type ApiCrmDealBoardProjection = SerializedDates<CrmDealBoardProjection>;
export type ApiCrmDealWorkbenchProjection = SerializedCrmDealWorkbenchProjection;
export type ApiCurrency = Currency;
export type ApiCurrencyOption = CurrencyOption;
export type ApiDealAcceptedQuote = SerializedDealWorkflowProjection["acceptedQuote"];
export type ApiDealAttachmentIngestion =
  SerializedDealWorkflowProjection["attachmentIngestions"][number];
export type ApiDealBankInstructionSnapshot =
  SerializedDates<DealBankInstructionSnapshot>;
export type ApiDealCalculationHistoryItem =
  SerializedCrmDealWorkbenchProjection["pricing"]["calculationHistory"][number];
export type ApiDealCounterpartySnapshot =
  SerializedDates<DealCounterpartySnapshot>;
export type ApiDealCustomerContext = NonNullable<
  SerializedCrmDealWorkbenchProjection["context"]["customer"]
>;
export type ApiDealOperationalState =
  SerializedDealWorkflowProjection["operationalState"];
export type ApiDealPricingQuote =
  SerializedCrmDealWorkbenchProjection["pricing"]["quotes"][number];
export type ApiDealSectionCompleteness =
  SerializedDealWorkflowProjection["sectionCompleteness"][number];
export type ApiDealTimelineEvent =
  SerializedDealWorkflowProjection["timeline"][number];
export type ApiDealTransitionBlocker =
  SerializedDealWorkflowProjection["transitionReadiness"][number]["blockers"][number];
export type ApiDealTransitionReadiness =
  SerializedDealWorkflowProjection["transitionReadiness"][number];
export type ApiDealWorkflowLeg =
  SerializedDealWorkflowProjection["executionPlan"][number];
export type ApiDealWorkflowParticipant =
  SerializedDealWorkflowProjection["participants"][number];
export type ApiDealWorkflowProjection = SerializedDealWorkflowProjection;
export type ApiOrganization = NonNullable<
  SerializedCrmDealWorkbenchProjection["context"]["internalEntity"]
>;
export type ApiProfitabilityAmount = NonNullable<
  SerializedCrmDealWorkbenchProjection["profitabilitySnapshot"]
>["feeRevenue"][number];
export type ApiProfitabilityCostVariance = NonNullable<
  SerializedCrmDealWorkbenchProjection["profitabilityVariance"]
>["varianceByCostFamily"][number];
export type ApiProfitabilityCoverageState = NonNullable<
  SerializedCrmDealWorkbenchProjection["profitabilityVariance"]
>["actualCoverage"]["state"];
export type ApiProfitabilityLegVariance = NonNullable<
  SerializedCrmDealWorkbenchProjection["profitabilityVariance"]
>["varianceByLeg"][number];
export type ApiProfitabilitySnapshot =
  SerializedCrmDealWorkbenchProjection["profitabilitySnapshot"];
export type ApiProfitabilityVariance =
  SerializedCrmDealWorkbenchProjection["profitabilityVariance"];
export type ApiQuoteCommercialTerms = NonNullable<
  ApiDealPricingQuote["commercialTerms"]
>;
export type ApiQuotePreview = {
  commercialTerms: ApiQuoteCommercialTerms | null;
  dealDirection: string | null;
  dealForm: string | null;
  expiresAt: string;
  feeComponents: {
    accountDirection: "payable" | "receivable" | "neutral";
    amountMinor: string;
    appliesTo: "from" | "to";
    chargingParty: "customer" | "provider" | "internal";
    collectionMode: "embedded_in_rate" | "off_quote" | "upfront";
    currency: string;
    description: string | null;
    kind: string;
    metadata: Record<string, unknown>;
    recipientPartyRef: string | null;
    source: string;
  }[];
  financialLines: {
    accountDirection: "debit" | "credit";
    amountMinor: string;
    currency: string;
    kind:
      | "provider_payable"
      | "provider_receivable"
      | "customer_payable"
      | "customer_receivable"
      | "fee_revenue"
      | "spread_revenue"
      | "pass_through";
    metadata: Record<string, unknown>;
  }[];
  fromAmount: string;
  fromAmountMinor: string;
  fromCurrency: string;
  legs: {
    asOf: string;
    executionCounterpartyId: string | null;
    fromAmountMinor: string;
    fromCurrency: string;
    idx: number;
    rateDen: string;
    rateNum: string;
    sourceKind: string;
    sourceRef: string | null;
    toAmountMinor: string;
    toCurrency: string;
  }[];
  pricingMode: string;
  pricingTrace: Record<string, unknown>;
  rateDen: string;
  rateNum: string;
  toAmount: string;
  toAmountMinor: string;
  toCurrency: string;
};
export type ApiReconciliationException =
  SerializedCrmDealWorkbenchProjection["relatedResources"]["reconciliationExceptions"][number];
export type ApiReconciliationSummary =
  SerializedCrmDealWorkbenchProjection["reconciliationSummary"];
export type ApiRequisite = NonNullable<
  SerializedCrmDealWorkbenchProjection["context"]["internalEntityRequisite"]
>;
export type ApiRequisiteProvider = NonNullable<
  SerializedCrmDealWorkbenchProjection["context"]["internalEntityRequisiteProvider"]
>;
