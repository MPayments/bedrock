import { defineModule, type DefinedModule } from "@bedrock/core";

import { createLedgerBedrockProviders } from "./providers";

export const ledgerModule: DefinedModule = defineModule("ledger", {
  providers: createLedgerBedrockProviders(),
});
