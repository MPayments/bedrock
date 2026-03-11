import { defineModule, type DefinedModule } from "@bedrock/core";

import { fxRatesController } from "./controller";
import { fxRatesService } from "./service";

export const fxRatesModule: DefinedModule = defineModule("fx-rates", {
  services: {
    "fx-rates": fxRatesService,
  },
  controllers: [fxRatesController],
});
