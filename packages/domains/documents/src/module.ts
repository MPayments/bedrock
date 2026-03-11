import { defineModule, type DefinedModule } from "@bedrock/core";

import { documentsController } from "./controller";
import { createDocumentsProviders } from "./providers";
import { documentsService } from "./service";

export const documentsModule: DefinedModule = defineModule("documents", {
  providers: createDocumentsProviders(),
  services: {
    documents: documentsService,
  },
  controllers: [documentsController],
});
