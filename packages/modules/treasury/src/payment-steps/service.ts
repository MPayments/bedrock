const emptyCommands = {};
const emptyQueries = {};

export function createPaymentStepsService() {
  return {
    commands: emptyCommands,
    queries: emptyQueries,
  };
}

export type PaymentStepsService = ReturnType<typeof createPaymentStepsService>;
