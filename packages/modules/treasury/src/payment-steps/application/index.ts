import { createAmendPaymentStepHandler } from "./commands/amend-step";
import { createCancelPaymentStepHandler } from "./commands/cancel-step";
import { createConfirmPaymentStepHandler } from "./commands/confirm-step";
import { createCreatePaymentStepHandler } from "./commands/create-step";
import { createSkipPaymentStepHandler } from "./commands/skip-step";
import { createSubmitPaymentStepHandler } from "./commands/submit-step";
import {
  createPaymentStepsServiceContext,
  type PaymentStepsServiceDeps,
} from "./context";
import { createGetPaymentStepByIdQuery } from "./queries/get-step-by-id";
import { createListPaymentStepsQuery } from "./queries/list-steps";

export function createPaymentStepsService(deps: PaymentStepsServiceDeps) {
  const context = createPaymentStepsServiceContext(deps);

  return {
    commands: {
      amend: createAmendPaymentStepHandler(context),
      cancel: createCancelPaymentStepHandler(context),
      confirm: createConfirmPaymentStepHandler(context),
      create: createCreatePaymentStepHandler(context),
      skip: createSkipPaymentStepHandler(context),
      submit: createSubmitPaymentStepHandler(context),
    },
    queries: {
      findById: createGetPaymentStepByIdQuery(context),
      list: createListPaymentStepsQuery(context),
    },
  };
}

export type PaymentStepsService = ReturnType<typeof createPaymentStepsService>;
