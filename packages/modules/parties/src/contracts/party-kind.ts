import { z } from "zod";

import {
  isCountryCode,
  normalizeCountryCode,
  PARTY_KIND_VALUES,
  type CountryCode as DomainCountryCode,
  type PartyKind as DomainPartyKind,
} from "../domain/party-kind";

export const PartyKindSchema = z.enum(PARTY_KIND_VALUES);
export type PartyKind = DomainPartyKind;

export const CounterpartyKindSchema = PartyKindSchema;
export type CounterpartyKind = PartyKind;

export const CountryCodeSchema = z
  .string()
  .trim()
  .transform((value) => normalizeCountryCode(value))
  .refine(
    (value) => isCountryCode(value),
    "country must be a valid ISO 3166-1 alpha-2 code",
  );

export type CountryCode = DomainCountryCode;
