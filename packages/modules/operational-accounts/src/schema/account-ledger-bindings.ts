import { operationalAccountBindings } from "@bedrock/accounting/schema";

export { operationalAccountBindings };

export type OperationalAccountBinding =
  typeof operationalAccountBindings.$inferSelect;
export type OperationalAccountBindingInsert =
  typeof operationalAccountBindings.$inferInsert;
