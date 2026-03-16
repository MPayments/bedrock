import { pgEnum } from "drizzle-orm/pg-core";

import { COUNTRY_ALPHA2_CODES } from "@bedrock/shared/reference-data/countries/contracts";

import { PARTY_KIND_VALUES } from "../../../domain/party-kind";

export const partyKindEnum = pgEnum("counterparty_kind", PARTY_KIND_VALUES);
export const partyCountryCodeEnum = pgEnum(
  "counterparty_country_code",
  COUNTRY_ALPHA2_CODES,
);
