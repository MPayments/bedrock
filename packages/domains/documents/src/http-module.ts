import { defineModule, type DefinedModule } from "@bedrock/core";

import { documentsController } from "./controller";
import { documentsService } from "./service";

export const documentsModule: DefinedModule = defineModule("documents", {
  services: {
    documents: documentsService,
  },
  controllers: [documentsController],
});
