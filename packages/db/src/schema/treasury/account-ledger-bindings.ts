import { operationalAccountsBookBindings } from "../accounting";

export { operationalAccountsBookBindings };

export type OperationalAccountsBookBinding =
  typeof operationalAccountsBookBindings.$inferSelect;
export type OperationalAccountsBookBindingInsert =
  typeof operationalAccountsBookBindings.$inferInsert;
export type OperationalAccountBinding = OperationalAccountsBookBinding;
export type OperationalAccountBindingInsert =
  OperationalAccountsBookBindingInsert;
