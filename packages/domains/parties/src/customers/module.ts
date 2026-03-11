import { defineModule, type DefinedModule } from "@bedrock/core";

import { customersController } from "./controller";
import { customersService } from "./service";

export const customersModule: DefinedModule = defineModule("customers", {
  services: {
    customers: customersService,
  },
  controllers: [customersController],
});
