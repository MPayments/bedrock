import type { DealType } from "../contracts/zod";

export interface DealAgreementReference {
  currentVersionId: string | null;
  id: string;
  customerId: string;
  organizationId: string;
  isActive: boolean;
  allowedDealTypes?: DealType[];
}

export interface DealCalculationReference {
  id: string;
  isActive: boolean;
}

export interface DealQuoteReference {
  agreementVersionId: string | null;
  dealId: string | null;
  expiresAt: Date | null;
  id: string;
  status: string;
  usedAt: Date | null;
  usedDocumentId: string | null;
}

export interface DealCurrencyReference {
  code: string;
  id: string;
  precision: number;
}

export interface DealReferencesPort {
  findAgreementById(id: string): Promise<DealAgreementReference | null>;
  findCalculationById(id: string): Promise<DealCalculationReference | null>;
  findCounterpartyById(
    id: string,
  ): Promise<
    | {
        id: string;
        customerId?: string | null;
        fullName?: string | null;
        shortName?: string | null;
      }
    | null
  >;
  findCurrencyById(id: string): Promise<DealCurrencyReference | null>;
  findCustomerById(id: string): Promise<{ id: string } | null>;
  findQuoteById(id: string): Promise<DealQuoteReference | null>;
  listActiveAgreementsByCustomerId(
    customerId: string,
  ): Promise<DealAgreementReference[]>;
  validateSupportedCreateType(type: DealType): void;
}
