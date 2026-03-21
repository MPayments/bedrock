import type { PartiesModule } from "@bedrock/parties";
import type { Logger } from "@bedrock/platform/observability/logger";

import {
  CustomerCreatedDataSchema,
  type IntegrationPayload,
} from "../contracts";

export interface CustomerCreatedHandlerDeps {
  createCustomer: PartiesModule["customers"]["commands"]["create"];
  listCustomers: PartiesModule["customers"]["queries"]["list"];
  logger: Logger;
}

export function createCustomerCreatedHandler(deps: CustomerCreatedHandlerDeps) {
  return async function handleCustomerCreated(
    event: IntegrationPayload,
  ): Promise<void> {
    const data = CustomerCreatedDataSchema.parse(event.data);
    const externalRef = String(event.entityId);

    // listCustomers internally parses through Zod which applies defaults for
    // pagination/sorting fields, so passing only the filter is safe at runtime.
    const existing = await deps.listCustomers({
      externalRef,
    } as Parameters<typeof deps.listCustomers>[0]);

    if (existing.data.length > 0) {
      deps.logger.info("Customer already exists, skipping creation", {
        externalRef,
        existingCustomerId: existing.data[0]!.id,
      });
      return;
    }

    const customer = await deps.createCustomer({
      externalRef,
      displayName: data.name,
      description: data.email,
    });

    deps.logger.info("Customer created from mpayments event", {
      customerId: customer.id,
      externalRef,
    });
  };
}
