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

export interface DealReferencesPort {
  findAgreementById(id: string): Promise<DealAgreementReference | null>;
  findCalculationById(id: string): Promise<DealCalculationReference | null>;
  findCounterpartyById(id: string): Promise<{ id: string } | null>;
  findCustomerById(id: string): Promise<{ id: string } | null>;
  validateSupportedCreateType(type: DealType): void;
}
