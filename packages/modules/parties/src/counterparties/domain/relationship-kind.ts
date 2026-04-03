import { z } from "zod";

export const COUNTERPARTY_RELATIONSHIP_KIND_VALUES = [
  "customer_owned",
  "external",
] as const;

export const CounterpartyRelationshipKindSchema = z.enum(
  COUNTERPARTY_RELATIONSHIP_KIND_VALUES,
);

export type CounterpartyRelationshipKind = z.infer<
  typeof CounterpartyRelationshipKindSchema
>;
