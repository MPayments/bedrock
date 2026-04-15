export interface CreateAgreementRootInput {
  id: string;
  customerId: string;
  organizationId: string;
  organizationRequisiteId: string;
  isActive?: boolean;
}

export interface StoredAgreementRoot {
  id: string;
  customerId: string;
  organizationId: string;
  organizationRequisiteId: string;
  isActive: boolean;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgreementVersionInput {
  id: string;
  agreementId: string;
  versionNumber: number;
  contractNumber: string | null;
  contractDate: Date | null;
}

export interface StoredAgreementVersion {
  id: string;
  agreementId: string;
  versionNumber: number;
  contractNumber: string | null;
  contractDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgreementFeeRuleStoredInput {
  id: string;
  agreementVersionId: string;
  kind: "agent_fee" | "fixed_fee";
  unit: "bps" | "money";
  valueNumeric: string;
  currencyId: string | null;
}

export interface StoredAgreementFeeRule {
  id: string;
  agreementVersionId: string;
  kind: "agent_fee" | "fixed_fee";
  unit: "bps" | "money";
  valueNumeric: string;
  currencyId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgreementPartyStoredInput {
  id: string;
  agreementVersionId: string;
  partyRole: "customer" | "organization";
  customerId: string | null;
  organizationId: string | null;
}

export interface StoredAgreementParty {
  id: string;
  agreementVersionId: string;
  partyRole: "customer" | "organization";
  customerId: string | null;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgreementRoutePolicyStoredInput {
  id: string;
  agreementVersionId: string;
  sequence: number;
  dealType:
    | "payment"
    | "currency_exchange"
    | "currency_transit"
    | "exporter_settlement"
    | "internal_treasury";
  sourceCurrencyId: string | null;
  targetCurrencyId: string | null;
  defaultMarkupBps: string | null;
  defaultWireFeeAmountMinor: string | null;
  defaultWireFeeCurrencyId: string | null;
  defaultSubAgentCommissionUnit: "bps" | "money" | null;
  defaultSubAgentCommissionBps: string | null;
  defaultSubAgentCommissionAmountMinor: string | null;
  defaultSubAgentCommissionCurrencyId: string | null;
  approvalThresholdAmountMinor: string | null;
  approvalThresholdCurrencyId: string | null;
  quoteValiditySeconds: number | null;
}

export interface StoredAgreementRoutePolicy {
  id: string;
  agreementVersionId: string;
  sequence: number;
  dealType:
    | "payment"
    | "currency_exchange"
    | "currency_transit"
    | "exporter_settlement"
    | "internal_treasury";
  sourceCurrencyId: string | null;
  targetCurrencyId: string | null;
  defaultMarkupBps: string | null;
  defaultWireFeeAmountMinor: bigint | null;
  defaultWireFeeCurrencyId: string | null;
  defaultSubAgentCommissionUnit: "bps" | "money" | null;
  defaultSubAgentCommissionBps: string | null;
  defaultSubAgentCommissionAmountMinor: bigint | null;
  defaultSubAgentCommissionCurrencyId: string | null;
  approvalThresholdAmountMinor: bigint | null;
  approvalThresholdCurrencyId: string | null;
  quoteValiditySeconds: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgreementRouteTemplateLinkStoredInput {
  id: string;
  agreementRoutePolicyId: string;
  routeTemplateId: string;
  sequence: number;
  isDefault: boolean;
}

export interface StoredAgreementRouteTemplateLink {
  id: string;
  agreementRoutePolicyId: string;
  routeTemplateId: string;
  sequence: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgreementStore {
  createAgreementRoot(
    input: CreateAgreementRootInput,
  ): Promise<StoredAgreementRoot>;
  createAgreementVersion(
    input: CreateAgreementVersionInput,
  ): Promise<StoredAgreementVersion>;
  createAgreementFeeRules(
    input: CreateAgreementFeeRuleStoredInput[],
  ): Promise<StoredAgreementFeeRule[]>;
  createAgreementParties(
    input: CreateAgreementPartyStoredInput[],
  ): Promise<StoredAgreementParty[]>;
  createAgreementRoutePolicies(
    input: CreateAgreementRoutePolicyStoredInput[],
  ): Promise<StoredAgreementRoutePolicy[]>;
  createAgreementRouteTemplateLinks(
    input: CreateAgreementRouteTemplateLinkStoredInput[],
  ): Promise<StoredAgreementRouteTemplateLink[]>;
  setCurrentVersion(input: {
    agreementId: string;
    currentVersionId: string;
  }): Promise<void>;
  setActive(input: { agreementId: string; isActive: boolean }): Promise<void>;
}
