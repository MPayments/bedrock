export interface CounterpartiesPort {
  createCustomerOwnedCounterparty(input: {
    country?: string | null;
    customerId: string;
    displayName: string;
    externalId?: string | null;
  }): Promise<string>;
  syncCustomerOwnedCounterparty(input: {
    counterpartyId: string;
    country?: string | null;
    customerId: string;
    displayName: string;
    externalId?: string | null;
  }): Promise<void>;
}
