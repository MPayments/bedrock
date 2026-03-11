import { defineModule, type DefinedModule } from "@bedrock/core";

import { balancesController } from "./controller";
import { balancesService } from "./service";

export const balancesModule: DefinedModule = defineModule("balances", {
  services: {
    balances: balancesService,
  },
  controllers: [balancesController],
});
