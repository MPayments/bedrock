import { defineModule, type DefinedModule } from "@bedrock/core";

import { organizationsController } from "./controller";
import { organizationsService } from "./service";

export const organizationsModule: DefinedModule = defineModule("organizations", {
  services: {
    organizations: organizationsService,
  },
  controllers: [organizationsController],
});
