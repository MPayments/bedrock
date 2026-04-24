import type { ModuleRuntime } from "@bedrock/shared/core";

import type { PaymentStepsRepository } from "./ports/payment-steps.repository";

export interface PaymentStepsServiceDeps {
  repository: PaymentStepsRepository;
  runtime: ModuleRuntime;
}

export interface PaymentStepsServiceContext {
  repository: PaymentStepsRepository;
  runtime: ModuleRuntime;
}

export function createPaymentStepsServiceContext(
  deps: PaymentStepsServiceDeps,
): PaymentStepsServiceContext {
  return {
    repository: deps.repository,
    runtime: deps.runtime,
  };
}
