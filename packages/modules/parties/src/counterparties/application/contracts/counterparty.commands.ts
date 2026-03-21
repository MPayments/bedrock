import { z } from "zod";

import {
  CountryCodeSchema,
  PartyKindSchema,
} from "../../../shared/domain/party-kind";

function trimToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const CreateCounterpartyInputSchema = z.object({
  shortName: z.string().trim().min(1, "shortName is required"),
  fullName: z.string().trim().min(1, "fullName is required"),
  kind: PartyKindSchema.default("legal_entity"),
  country: CountryCodeSchema.nullish().transform((value) => value ?? null),
  externalId: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  description: z
    .string()
    .trim()
    .nullish()
    .transform((value) => trimToNull(value) ?? null),
  customerId: z
    .uuid()
    .nullish()
    .transform((value) => value ?? null),
  groupIds: z.array(z.uuid()).default([]),
});

export type CreateCounterpartyInput = z.input<
  typeof CreateCounterpartyInputSchema
>;

export const UpdateCounterpartyInputSchema = z.object({
  shortName: z.string().trim().min(1).exactOptional(),
  fullName: z.string().trim().min(1).exactOptional(),
  kind: PartyKindSchema.exactOptional(),
  country: CountryCodeSchema.nullable().exactOptional(),
  externalId: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  description: z
    .string()
    .trim()
    .nullable()
    .transform((value) => trimToNull(value))
    .exactOptional(),
  customerId: z.uuid().nullable().exactOptional(),
  groupIds: z.array(z.uuid()).exactOptional(),
});

export type UpdateCounterpartyInput = z.input<
  typeof UpdateCounterpartyInputSchema
>;
