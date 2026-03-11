import { defineModule, type DefinedModule } from "@bedrock/core";

import { paymentsController } from "./controller";
import { paymentsService } from "./service";

export const paymentsModule: DefinedModule = defineModule("payments", {
  services: {
    payments: paymentsService,
  },
  controllers: [paymentsController],
});
