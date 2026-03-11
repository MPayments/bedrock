import { defineModule, type DefinedModule } from "@bedrock/core";

import { fxRatesModule } from "./fx-rates/module";
import {
  createTreasuryBedrockProviders,
  createTreasuryFxBedrockProviders,
  createTreasuryPaymentsBedrockProviders,
} from "./providers";
import { paymentsModule } from "./payments/module";

export const treasuryFxModule: DefinedModule = defineModule("treasury-fx", {
  providers: createTreasuryFxBedrockProviders(),
  imports: [fxRatesModule],
});

export const treasuryPaymentsModule: DefinedModule = defineModule("treasury-payments", {
  providers: createTreasuryPaymentsBedrockProviders(),
  imports: [paymentsModule],
});

export const treasuryModule: DefinedModule = defineModule("treasury", {
  providers: createTreasuryBedrockProviders(),
  imports: [fxRatesModule, paymentsModule],
});
