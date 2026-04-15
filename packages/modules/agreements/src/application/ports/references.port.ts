export interface AgreementRequisiteSubject {
  id: string;
  ownerType: "organization" | "counterparty";
  organizationId: string | null;
}

export interface AgreementRouteTemplateReference {
  dealType:
    | "payment"
    | "currency_exchange"
    | "currency_transit"
    | "exporter_settlement"
    | "internal_treasury";
  id: string;
  status: "draft" | "published" | "archived";
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
  findRouteTemplateById(
    id: string,
  ): Promise<AgreementRouteTemplateReference | null>;
  assertCurrencyExists(id: string): Promise<void>;
}
