import { defineModule, type DefinedModule } from "@bedrock/core";

import { accountingController } from "./controller";
import { accountingService } from "./service";

export const accountingModule: DefinedModule = defineModule("accounting", {
  services: {
    accounting: accountingService,
  },
  controllers: [accountingController],
});
