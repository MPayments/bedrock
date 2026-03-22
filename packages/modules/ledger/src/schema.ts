import {
  bookAccountInstances,
  books,
  ledgerOperations,
  outbox,
  postings,
  schema as ledgerSchema,
  tbTransferPlans,
} from "./adapters/drizzle/schema/index";
import {
  balanceEvents,
  balanceHolds,
  balancePositions,
  balanceProjectorCursors,
  schema as balancesSchema,
} from "./balances/adapters/drizzle/schema/index";

export const schema = {
  ...ledgerSchema,
  ...balancesSchema,
} satisfies typeof ledgerSchema & typeof balancesSchema;

export {
  balanceEvents,
  balanceHolds,
  balancePositions,
  balanceProjectorCursors,
  bookAccountInstances,
  books,
  ledgerOperations,
  outbox,
  postings,
  tbTransferPlans,
};
