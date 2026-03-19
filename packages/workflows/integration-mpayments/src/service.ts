import type { CurrenciesService } from "@bedrock/currencies";
import type { PartiesService } from "@bedrock/parties";
import type { Logger } from "@bedrock/platform/observability/logger";
import type { RequisitesService } from "@bedrock/requisites";

import { IntegrationPayloadSchema } from "./contracts";
import { createClientCreatedHandler } from "./handlers/client-created";
import { createCustomerCreatedHandler } from "./handlers/customer-created";

export interface IntegrationEventHandlerDeps {
  createCustomer: PartiesService["customers"]["create"];
  listCustomers: PartiesService["customers"]["list"];
  createCounterparty: PartiesService["counterparties"]["create"];
  listCounterparties: PartiesService["counterparties"]["list"];
  createRequisite: RequisitesService["create"];
  listProviders: RequisitesService["providers"]["list"];
  createProvider: RequisitesService["providers"]["create"];
  findCurrencyByCode: CurrenciesService["findByCode"];
  logger: Logger;
}

export interface IntegrationEventHandler {
  processEvent(raw: unknown): Promise<void>;
}

export function createIntegrationEventHandler(
  deps: IntegrationEventHandlerDeps,
): IntegrationEventHandler {
  const handleCustomerCreated = createCustomerCreatedHandler({
    createCustomer: deps.createCustomer,
    listCustomers: deps.listCustomers,
    logger: deps.logger,
  });

  const handleClientCreated = createClientCreatedHandler({
    createCounterparty: deps.createCounterparty,
    listCounterparties: deps.listCounterparties,
    listCustomers: deps.listCustomers,
    createRequisite: deps.createRequisite,
    listProviders: deps.listProviders,
    createProvider: deps.createProvider,
    findCurrencyByCode: deps.findCurrencyByCode,
    logger: deps.logger,
  });

  return {
    async processEvent(raw: unknown): Promise<void> {
      const event = IntegrationPayloadSchema.parse(raw);

      if (event.entity === "customer" && event.action === "created") {
        await handleCustomerCreated(event);
        return;
      }

      if (event.entity === "client" && event.action === "created") {
        await handleClientCreated(event);
        return;
      }

      deps.logger.info("Ignoring unhandled integration event", {
        entity: event.entity,
        action: event.action,
        entityId: event.entityId,
      });
    },
  };
}
