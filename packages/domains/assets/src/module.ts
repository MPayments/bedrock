import { defineModule, type DefinedModule } from "@bedrock/core";

import { currenciesController } from "./controller";
import { createAssetsProviders } from "./providers";
import { currenciesService } from "./service";

export const assetsModule: DefinedModule = defineModule("assets", {
  providers: createAssetsProviders(),
  services: {
    currencies: currenciesService,
  },
  controllers: [currenciesController],
});
