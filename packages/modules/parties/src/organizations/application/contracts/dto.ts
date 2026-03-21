import { z } from "zod";

import {
  createPaginatedListSchema,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import {
  CountryCodeSchema,
  PartyKindSchema,
  type PartyKind,
} from "../../domain/party-kind";

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

export type Organization = z.output<typeof OrganizationSchema>;
export type OrganizationKind = PartyKind;

export const PaginatedOrganizationsSchema =
  createPaginatedListSchema(OrganizationSchema);

export type PaginatedOrganizations = PaginatedList<Organization>;

export const OrganizationOptionSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  label: z.string(),
});

export const OrganizationOptionsResponseSchema = z.object({
  data: z.array(OrganizationOptionSchema),
});

export type OrganizationOption = z.infer<typeof OrganizationOptionSchema>;
