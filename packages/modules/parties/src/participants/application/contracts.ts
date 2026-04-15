import { z } from "zod";

import {
  CounterpartyRelationshipKindSchema,
} from "../../counterparties/domain/relationship-kind";
import { PartyKindSchema } from "../../shared/domain/party-kind";

export const PARTICIPANT_LOOKUP_KIND_VALUES = [
  "customer",
  "counterparty",
  "organization",
  "sub_agent",
] as const;

export const ParticipantLookupKindSchema = z.enum(
  PARTICIPANT_LOOKUP_KIND_VALUES,
);

export const ROUTE_COMPOSER_ROLE_HINT_VALUES = [
  "deal_owner",
  "customer_legal_entity",
  "external_counterparty",
  "internal_entity",
  "liquidity_source",
  "sub_agent",
] as const;

export const RouteComposerRoleHintSchema = z.enum(
  ROUTE_COMPOSER_ROLE_HINT_VALUES,
);

export const ParticipantRequisiteSummarySchema = z.object({
  bankCount: z.int().nonnegative(),
  hasDefault: z.boolean(),
  totalCount: z.int().nonnegative(),
});

export const ParticipantLookupItemSchema = z.object({
  country: z.string().nullable(),
  customerId: z.uuid().nullable(),
  displayName: z.string(),
  id: z.uuid(),
  isActive: z.boolean(),
  legalName: z.string(),
  participantKind: ParticipantLookupKindSchema,
  partyKind: PartyKindSchema.nullable(),
  relationshipKind: CounterpartyRelationshipKindSchema.nullable(),
  requisites: ParticipantRequisiteSummarySchema,
  roleHints: z.array(RouteComposerRoleHintSchema),
  shortName: z.string().nullable(),
});

export const ParticipantLookupResponseSchema = z.object({
  data: z.array(ParticipantLookupItemSchema),
});

export const ParticipantLookupQuerySchema = z.object({
  activeOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? true : value === "true")),
  customerId: z.uuid().optional(),
  kind: ParticipantLookupKindSchema.optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
  q: z.string().trim().max(120).optional().default(""),
});

export const CustomerLegalEntitiesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
  q: z.string().trim().max(120).optional().default(""),
});

export const RouteComposerParticipantKindSchema = z.object({
  backedBy: z.enum([
    "customers",
    "counterparties",
    "organizations",
    "sub_agent_profiles",
  ]),
  description: z.string(),
  internalOnly: z.boolean(),
  kind: ParticipantLookupKindSchema,
  label: z.string(),
  note: z.string().nullable(),
});

export const RouteComposerRoleHintDefinitionSchema = z.object({
  description: z.string(),
  id: RouteComposerRoleHintSchema,
  label: z.string(),
});

export const RouteComposerLookupContextSchema = z.object({
  lookupDefaults: z.object({
    defaultLimit: z.int().positive(),
    maxLimit: z.int().positive(),
    prefixMatching: z.boolean(),
  }),
  participantKinds: z.array(RouteComposerParticipantKindSchema),
  roleHints: z.array(RouteComposerRoleHintDefinitionSchema),
  strictSemantics: z.object({
    accessControlOwnedByIam: z.boolean(),
    customerLegalEntitiesViaCounterparties: z.boolean(),
    organizationsInternalOnly: z.boolean(),
    subAgentsRequireCanonicalProfile: z.boolean(),
  }),
});

export type ParticipantLookupKind = z.output<typeof ParticipantLookupKindSchema>;
export type RouteComposerRoleHint = z.output<
  typeof RouteComposerRoleHintSchema
>;
export type ParticipantRequisiteSummary = z.output<
  typeof ParticipantRequisiteSummarySchema
>;
export type ParticipantLookupItem = z.output<typeof ParticipantLookupItemSchema>;
export type ParticipantLookupQuery = z.output<
  typeof ParticipantLookupQuerySchema
>;
export type ParticipantLookupResponse = z.output<
  typeof ParticipantLookupResponseSchema
>;
export type CustomerLegalEntitiesQuery = z.output<
  typeof CustomerLegalEntitiesQuerySchema
>;
export type RouteComposerLookupContext = z.output<
  typeof RouteComposerLookupContextSchema
>;
