import { defineModule, type DefinedModule } from "@bedrock/core";

import { requisitesController } from "./controller";
import { requisitesService } from "./service";

export const requisitesModule: DefinedModule = defineModule("requisites", {
  services: {
    requisites: requisitesService,
  },
  controllers: [requisitesController],
});
