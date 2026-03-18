import { z } from "zod";

import type { CounterpartySnapshot } from "../../domain/counterparty";
import { CountryCodeSchema, CounterpartyKindSchema } from "../zod";

export const CounterpartySchema = z.object({
  id: z.uuid(),
  externalId: z.string().nullable(),
  customerId: z.uuid().nullable(),
  shortName: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  country: CountryCodeSchema.nullable(),
  kind: CounterpartyKindSchema,
  groupIds: z.array(z.uuid()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Counterparty = CounterpartySnapshot;

export const CounterpartyOptionSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  label: z.string(),
});

export const CounterpartyOptionsResponseSchema = z.object({
  data: z.array(CounterpartyOptionSchema),
});

export type CounterpartyOption = z.infer<typeof CounterpartyOptionSchema>;
