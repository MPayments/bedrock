import { z } from "zod";

import { createPaginatedListSchema, type PaginatedList } from "@bedrock/shared/core/pagination";

import { PartyProfileBundleSchema } from "../../../party-profiles/application/contracts";
import {
  CountryCodeSchema,
  PartyKindSchema,
} from "../../../shared/domain/party-kind";
import { CounterpartyRelationshipKindSchema } from "../../domain/relationship-kind";

export const CounterpartyListItemSchema = z.object({
  id: z.uuid(),
  externalRef: z.string().nullable(),
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

export const CounterpartySchema = CounterpartyListItemSchema.extend({
  partyProfile: PartyProfileBundleSchema.nullable(),
});

export type Counterparty = z.output<typeof CounterpartySchema>;

export const PaginatedCounterpartiesSchema =
  createPaginatedListSchema(CounterpartyListItemSchema);

export type CounterpartyListItem = z.output<typeof CounterpartyListItemSchema>;
export type PaginatedCounterparties = PaginatedList<CounterpartyListItem>;

export const CounterpartyOptionSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  label: z.string(),
});

export const CounterpartyOptionsResponseSchema = z.object({
  data: z.array(CounterpartyOptionSchema),
});

export type CounterpartyOption = z.output<typeof CounterpartyOptionSchema>;
