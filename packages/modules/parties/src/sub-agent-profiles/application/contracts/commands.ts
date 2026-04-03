import { z } from "zod";

import {
  CountryCodeSchema,
  PartyKindSchema,
} from "../../../shared/domain/party-kind";

export const CreateSubAgentProfileInputSchema = z.object({
  shortName: z.string().trim().min(1, "shortName is required"),
  fullName: z.string().trim().min(1).optional(),
  kind: PartyKindSchema.default("individual"),
  country: CountryCodeSchema.nullish().transform((value) => value ?? null),
  commissionRate: z.number().min(0),
  isActive: z.boolean().optional(),
});

export type CreateSubAgentProfileInput = z.input<
  typeof CreateSubAgentProfileInputSchema
>;

export const UpdateSubAgentProfileInputSchema = z.object({
  shortName: z.string().trim().min(1).optional(),
  fullName: z.string().trim().min(1).nullable().optional(),
  kind: PartyKindSchema.optional(),
  country: CountryCodeSchema.nullable().optional(),
  commissionRate: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSubAgentProfileInput = z.input<
  typeof UpdateSubAgentProfileInputSchema
>;
