import type { DealType } from "../contracts/zod";

export interface DealAgreementReference {
  id: string;
  customerId: string;
  organizationId: string;
  isActive: boolean;
}

export interface DealCalculationReference {
  id: string;
  isActive: boolean;
}

export interface DealCurrencyReference {
  code: string;
  id: string;
  precision: number;
}

export interface DealReferencesPort {
  findAgreementById(id: string): Promise<DealAgreementReference | null>;
  findCalculationById(id: string): Promise<DealCalculationReference | null>;
  findCounterpartyById(id: string): Promise<{ id: string } | null>;
  findCurrencyById(id: string): Promise<DealCurrencyReference | null>;
  findCustomerById(id: string): Promise<{ id: string } | null>;
  listActiveAgreementsByCustomerId(
    customerId: string,
  ): Promise<DealAgreementReference[]>;
  validateSupportedCreateType(type: DealType): void;
}
