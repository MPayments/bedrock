import { token } from "@bedrock/core";
import type { CurrenciesService } from "./runtime";

export const CurrenciesDomainServiceToken = token<CurrenciesService>(
  "multihansa.assets.currencies-domain-service",
);
