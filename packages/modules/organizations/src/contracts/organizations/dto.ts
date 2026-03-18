import { z } from "zod";

import type { OrganizationSnapshot } from "../../domain/organization";
import { CountryCodeSchema, PartyKindSchema, type PartyKind } from "../zod";

export const OrganizationSchema = z.object({
  id: z.uuid(),
  externalId: z.string().nullable(),
  shortName: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  country: CountryCodeSchema.nullable(),
  kind: PartyKindSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Organization = OrganizationSnapshot;
export type OrganizationKind = PartyKind;

export const OrganizationOptionSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  label: z.string(),
});

export const OrganizationOptionsResponseSchema = z.object({
  data: z.array(OrganizationOptionSchema),
});

export type OrganizationOption = z.infer<typeof OrganizationOptionSchema>;
