import { defineModule, type DefinedModule } from "@bedrock/core";

import { requisiteProvidersController } from "./controller";
import { requisiteProvidersService } from "./service";

export const requisiteProvidersModule: DefinedModule = defineModule("requisite-providers", {
  services: {
    "requisite-providers": requisiteProvidersService,
  },
  controllers: [requisiteProvidersController],
});
