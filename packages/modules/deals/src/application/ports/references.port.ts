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
  findOrganizationById(
    id: string,
  ): Promise<{ id: string; shortName?: string | null } | null>;
  findRequisiteById(
    id: string,
  ): Promise<{ id: string; ownerId: string; ownerType: "counterparty" | "organization" } | null>;
  listActiveAgreementsByCustomerId(
    customerId: string,
  ): Promise<DealAgreementReference[]>;
  validateSupportedCreateType(type: DealType): void;
}
