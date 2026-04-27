import type { ModuleRuntime } from "@bedrock/shared/core";

import type { PaymentStepsService } from "../../payment-steps/application";
import type { TreasuryOrdersRepository } from "./ports/treasury-orders.repository";

export interface TreasuryOrdersServiceDeps {
  paymentSteps: PaymentStepsService;
  repository: TreasuryOrdersRepository;
  runtime: ModuleRuntime;
}

export type TreasuryOrdersServiceContext = TreasuryOrdersServiceDeps;

export function createTreasuryOrdersServiceContext(
  deps: TreasuryOrdersServiceDeps,
): TreasuryOrdersServiceContext {
  return deps;
}
