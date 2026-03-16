import { z } from "zod";

import { trimToNull } from "@bedrock/shared/core";

import { CountryCodeSchema, PartyKindSchema } from "../zod";

export const CreateOrganizationInputSchema = z.object({
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
});

export type CreateOrganizationInput = z.input<
  typeof CreateOrganizationInputSchema
>;

export const UpdateOrganizationInputSchema = z.object({
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
});

export type UpdateOrganizationInput = z.input<
  typeof UpdateOrganizationInputSchema
>;
