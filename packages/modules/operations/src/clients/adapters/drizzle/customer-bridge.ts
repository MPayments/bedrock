import { DrizzleCustomerReads, DrizzleCustomerStore } from "@bedrock/parties/adapters/drizzle";
import type { Queryable } from "@bedrock/platform/persistence";

import type { CustomerBridgePort } from "../../application/ports/customer-bridge.port";

export class DrizzleCustomerBridge implements CustomerBridgePort {
  private readonly customerReads: DrizzleCustomerReads;
  private readonly customerStore: DrizzleCustomerStore;

  constructor(db: Queryable) {
    this.customerReads = new DrizzleCustomerReads(db);
    this.customerStore = new DrizzleCustomerStore(db);
  }

  async ensureLinkedCustomer(input: {
    customerId?: string | null;
    displayName: string;
    legacyClientId: number;
    nextCustomerId: string;
  }): Promise<string> {
    const externalRef = `ops-client:${input.legacyClientId}`;

    if (input.customerId) {
      const existing = await this.customerStore.findById(input.customerId);
      if (existing) {
        await this.customerStore.update({
          id: existing.id,
          externalRef,
          displayName: input.displayName,
          description: existing.description,
        });

        return existing.id;
      }

      await this.customerStore.create({
        id: input.customerId,
        externalRef,
        displayName: input.displayName,
        description: null,
      });

      return input.customerId;
    }

    const existingByExternalRef = await this.customerReads.list({
      externalRef,
      limit: 1,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    if (existingByExternalRef.data[0]) {
      const existing = existingByExternalRef.data[0];

      await this.customerStore.update({
        id: existing.id,
        externalRef,
        displayName: input.displayName,
        description: existing.description,
      });

      return existing.id;
    }

    await this.customerStore.create({
      id: input.nextCustomerId,
      externalRef,
      displayName: input.displayName,
      description: null,
    });

    return input.nextCustomerId;
  }
}
