import { defineModule, type DefinedModule } from "@bedrock/core";

import { accountingController } from "./controller";
import { createAccountingProviders } from "./providers";
import { accountingService } from "./service";

export const accountingModule: DefinedModule = defineModule("accounting", {
  providers: createAccountingProviders(),
  services: {
    accounting: accountingService,
  },
  controllers: [accountingController],
});
