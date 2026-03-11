import type { AppDescriptor } from "@bedrock/core";
import { accountingModule } from "@multihansa/accounting";
import { assetsModule } from "@multihansa/assets";
import { balancesModule } from "@multihansa/balances";
import { documentsModule } from "@multihansa/documents";
import { identityModule } from "@multihansa/identity";
import { ledgerModule } from "@multihansa/ledger";
import { partiesModule } from "@multihansa/parties";
import { reportingModule } from "@multihansa/reporting";
import { treasuryModule } from "@multihansa/treasury";

import { createPlatformModule } from "./platform";

export function createMultihansaApiModules(input: {
  getContract: () => AppDescriptor;
}) {
  return [
    createPlatformModule({
      getContract: input.getContract,
      openApiInfo: {
        title: "Multihansa API",
        version: "1.0.0",
        description: "Deterministic financial API",
      },
    }),
    ledgerModule,
    identityModule,
    assetsModule,
    partiesModule,
    accountingModule,
    reportingModule,
    balancesModule,
    documentsModule,
    treasuryModule,
  ] as const;
}

export {
  accountingModule,
  assetsModule,
  balancesModule,
  documentsModule,
  identityModule,
  ledgerModule,
  partiesModule,
  reportingModule,
  treasuryModule,
};
