export interface CustomerBridgePort {
  ensureLinkedCustomer(input: {
    customerId?: string | null;
    displayName: string;
    legacyClientId: number;
    nextCustomerId: string;
  }): Promise<string>;
}
