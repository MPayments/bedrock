import type { Transaction } from "@bedrock/platform-persistence";

export interface CustomerLifecycleSyncPort {
  onCustomerCreated(
    tx: Transaction,
    input: {
      customerId: string;
      displayName: string;
    },
  ): Promise<void>;
  onCustomerRenamed(
    tx: Transaction,
    input: {
      customerId: string;
      displayName: string;
    },
  ): Promise<void>;
  onCustomerDeleted(
    tx: Transaction,
    input: {
      customerId: string;
    },
  ): Promise<void>;
}
