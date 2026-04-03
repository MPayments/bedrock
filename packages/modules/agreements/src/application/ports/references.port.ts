export interface AgreementRequisiteSubject {
  id: string;
  ownerType: "organization" | "counterparty";
  organizationId: string | null;
}

export interface AgreementReferencesPort {
  findCustomerById(id: string): Promise<{ id: string } | null>;
  findOrganizationById(id: string): Promise<{ id: string } | null>;
  findRequisiteSubjectById(
    requisiteId: string,
  ): Promise<AgreementRequisiteSubject | null>;
  findOrganizationRequisiteBindingByRequisiteId(
    requisiteId: string,
  ): Promise<{ requisiteId: string } | null>;
  assertCurrencyExists(id: string): Promise<void>;
}
