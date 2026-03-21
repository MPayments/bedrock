import { z } from "zod";

export const PARTY_KIND_VALUES = ["legal_entity", "individual"] as const;

export type PartyKind = (typeof PARTY_KIND_VALUES)[number];

export const PartyKindSchema = z.enum(PARTY_KIND_VALUES);
