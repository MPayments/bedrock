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
  feeBillingMode: "included_in_principal_invoice" | "separate_fee_invoice";
}

export interface StoredAgreementVersion {
  id: string;
  agreementId: string;
  versionNumber: number;
  contractNumber: string | null;
  contractDate: Date | null;
  feeBillingMode: "included_in_principal_invoice" | "separate_fee_invoice";
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
  setCurrentVersion(input: {
    agreementId: string;
    currentVersionId: string;
  }): Promise<void>;
  setActive(input: { agreementId: string; isActive: boolean }): Promise<void>;
}
