import { defineModule, type DefinedModule } from "@bedrock/core";

import { counterpartyGroupsController } from "./controller";
import { counterpartyGroupsService } from "./service";

export const counterpartyGroupsModule: DefinedModule = defineModule("counterparty-groups", {
  services: {
    "counterparty-groups": counterpartyGroupsService,
  },
  controllers: [counterpartyGroupsController],
});
