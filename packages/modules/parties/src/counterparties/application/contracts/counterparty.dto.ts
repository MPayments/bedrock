import { z } from "zod";

import { createPaginatedListSchema, type PaginatedList } from "@bedrock/shared/core/pagination";

import {
  CountryCodeSchema,
  PartyKindSchema,
} from "../../../shared/domain/party-kind";
import { CounterpartyRelationshipKindSchema } from "../../domain/relationship-kind";

export const CounterpartySchema = z.object({
  id: z.uuid(),
  externalId: z.string().nullable(),
  customerId: z.uuid().nullable(),
  relationshipKind: CounterpartyRelationshipKindSchema,
  shortName: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  country: CountryCodeSchema.nullable(),
  kind: PartyKindSchema,
  groupIds: z.array(z.uuid()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Counterparty = z.output<typeof CounterpartySchema>;

export const PaginatedCounterpartiesSchema =
  createPaginatedListSchema(CounterpartySchema);

export type PaginatedCounterparties = PaginatedList<Counterparty>;

export const CounterpartyOptionSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  label: z.string(),
});

export const CounterpartyOptionsResponseSchema = z.object({
  data: z.array(CounterpartyOptionSchema),
});

export type CounterpartyOption = z.output<typeof CounterpartyOptionSchema>;
