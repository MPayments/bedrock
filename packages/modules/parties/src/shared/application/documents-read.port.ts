export interface PartyRegistryDocumentsReadPort {
  hasDocumentsForCustomer(customerId: string): Promise<boolean>;
}
