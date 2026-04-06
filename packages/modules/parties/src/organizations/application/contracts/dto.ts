import { z } from "zod";

import {
  createPaginatedListSchema,
  type PaginatedList,
} from "@bedrock/shared/core/pagination";

import { PartyLegalEntityBundleSchema } from "../../../legal-entities/application/contracts";
import {
  PartyKindSchema,
  type PartyKind,
} from "../../domain/party-kind";

export const OrganizationListItemSchema = z.object({
  id: z.uuid(),
  externalId: z.string().nullable(),
  shortName: z.string(),
  fullName: z.string(),
  description: z.string().nullable(),
  country: z.string().nullable(),
  kind: PartyKindSchema,
  isActive: z.boolean(),
  signatureKey: z.string().nullable(),
  sealKey: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const OrganizationSchema = OrganizationListItemSchema.extend({
  legalEntity: PartyLegalEntityBundleSchema.nullable(),
});

export type Organization = z.output<typeof OrganizationSchema>;
export type OrganizationKind = PartyKind;

export const PaginatedOrganizationsSchema =
  createPaginatedListSchema(OrganizationListItemSchema);

export type OrganizationListItem = z.output<typeof OrganizationListItemSchema>;
export type PaginatedOrganizations = PaginatedList<OrganizationListItem>;

export const OrganizationOptionSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  label: z.string(),
});

export const OrganizationOptionsResponseSchema = z.object({
  data: z.array(OrganizationOptionSchema),
});

export type OrganizationOption = z.infer<typeof OrganizationOptionSchema>;
