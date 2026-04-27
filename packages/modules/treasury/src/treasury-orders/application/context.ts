import type { ModuleRuntime } from "@bedrock/shared/core";

import type { TreasuryOrdersRepository } from "./ports/treasury-orders.repository";
import type { PaymentStepsService } from "../../payment-steps/application";
import type { QuoteExecutionsService } from "../../quote-executions/application";

export interface TreasuryOrdersServiceDeps {
  paymentSteps: PaymentStepsService;
  quoteExecutions: QuoteExecutionsService;
  repository: TreasuryOrdersRepository;
  runtime: ModuleRuntime;
}

export type TreasuryOrdersServiceContext = TreasuryOrdersServiceDeps;

export function createTreasuryOrdersServiceContext(
  deps: TreasuryOrdersServiceDeps,
): TreasuryOrdersServiceContext {
  return deps;
}
