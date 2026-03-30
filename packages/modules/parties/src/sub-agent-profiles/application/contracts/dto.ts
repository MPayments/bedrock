import { z } from "zod";

import { createPaginatedListSchema } from "@bedrock/shared/core/pagination";

import {
  CountryCodeSchema,
  PartyKindSchema,
} from "../../../shared/domain/party-kind";

export const SubAgentProfileSchema = z.object({
  counterpartyId: z.uuid(),
  shortName: z.string(),
  fullName: z.string(),
  kind: PartyKindSchema,
  country: CountryCodeSchema.nullable(),
  commissionRate: z.number(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SubAgentProfile = z.output<typeof SubAgentProfileSchema>;

export const PaginatedSubAgentProfilesSchema =
  createPaginatedListSchema(SubAgentProfileSchema);

export type PaginatedSubAgentProfiles = z.output<
  typeof PaginatedSubAgentProfilesSchema
>;
