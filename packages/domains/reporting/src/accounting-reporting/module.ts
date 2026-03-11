import { defineModule, type DefinedModule } from "@bedrock/core";

import { accountingReportsController } from "./controller";
import { accountingReportsService } from "./service";

export const accountingReportsModule: DefinedModule = defineModule("accounting-reports", {
  services: {
    "accounting-reports": accountingReportsService,
  },
  controllers: [accountingReportsController],
});
