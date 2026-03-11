import { defineModule, type DefinedModule } from "@bedrock/core";

import { documentsJournalController } from "./controller";
import { documentsJournalService } from "./service";

export const documentsJournalModule: DefinedModule = defineModule("documents-journal", {
  services: {
    "documents-journal": documentsJournalService,
  },
  controllers: [documentsJournalController],
});
