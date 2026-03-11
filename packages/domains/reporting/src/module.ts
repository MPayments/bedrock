import { defineModule, type DefinedModule } from "@bedrock/core";

import { accountingReportsModule } from "./accounting-reporting/module";
import { documentsJournalModule } from "./documents-journal/module";
import { createReportingBedrockProviders } from "./providers";

export const reportingModule: DefinedModule = defineModule("reporting", {
  providers: createReportingBedrockProviders(),
  imports: [accountingReportsModule, documentsJournalModule],
});
