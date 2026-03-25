export interface CounterpartiesPort {
  findOrCreateCounterparty(input: {
    displayName: string;
    externalRef?: string | null;
  }): Promise<string>;
}
