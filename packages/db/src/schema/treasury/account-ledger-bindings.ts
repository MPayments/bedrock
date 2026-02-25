import { operationalAccountBindings } from "../accounting";

export { operationalAccountBindings };

export type OperationalAccountBinding = typeof operationalAccountBindings.$inferSelect;
export type OperationalAccountBindingInsert = typeof operationalAccountBindings.$inferInsert;
