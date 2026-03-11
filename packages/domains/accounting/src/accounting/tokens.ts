import { token } from "@bedrock/core";
import type { AccountingPackDefinition } from "./packs/schema";
import type { AccountingService } from "./runtime-service";

export const AccountingDomainServiceToken = token<AccountingService>(
  "multihansa.accounting.domain-service",
);

export const AccountingPackDefinitionToken = token<AccountingPackDefinition>(
  "multihansa.accounting.pack-definition",
);
