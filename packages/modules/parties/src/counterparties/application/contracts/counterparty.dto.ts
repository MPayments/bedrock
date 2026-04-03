import { z } from "zod";

import { createPaginatedListSchema, type PaginatedList } from "@bedrock/shared/core/pagination";

import {
  CountryCodeSchema,
  PartyKindSchema,
} from "../../../shared/domain/party-kind";
import { CounterpartyRelationshipKindSchema } from "../../domain/relationship-kind";

const LocalizedTextSchema = z
  .object({
    en: z.string().nullable().optional(),
    ru: z.string().nullable().optional(),
  })
  .nullable();

export const CounterpartySchema = z.object({
  id: z.uuid(),
  externalId: z.string().nullable(),
  customerId: z.uuid().nullable(),
  relationshipKind: CounterpartyRelationshipKindSchema,
  shortName: z.string(),
  fullName: z.string(),
  orgNameI18n: LocalizedTextSchema,
  orgType: z.string().nullable(),
  orgTypeI18n: LocalizedTextSchema,
  directorName: z.string().nullable(),
  directorNameI18n: LocalizedTextSchema,
  position: z.string().nullable(),
  positionI18n: LocalizedTextSchema,
  directorBasis: z.string().nullable(),
  directorBasisI18n: LocalizedTextSchema,
  address: z.string().nullable(),
  addressI18n: LocalizedTextSchema,
  email: z.string().nullable(),
  phone: z.string().nullable(),
  inn: z.string().nullable(),
  kpp: z.string().nullable(),
  ogrn: z.string().nullable(),
  oktmo: z.string().nullable(),
  okpo: z.string().nullable(),
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
