import { defineModule, type DefinedModule } from "@bedrock/core";

import { counterpartiesController } from "./controller";
import { counterpartiesService } from "./service";

export const counterpartiesModule: DefinedModule = defineModule("counterparties", {
  services: {
    counterparties: counterpartiesService,
  },
  controllers: [counterpartiesController],
});
