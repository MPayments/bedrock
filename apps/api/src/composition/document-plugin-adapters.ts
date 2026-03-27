import type { CurrenciesService } from "@bedrock/currencies";
import {
  createCommercialDocumentDeps as createCommercialPluginDocumentDeps,
} from "@bedrock/plugin-documents-commercial";
import type { Requisite } from "@bedrock/parties/contracts";
import { createIfrsDocumentDeps } from "@bedrock/plugin-documents-ifrs";
import type { Database } from "@bedrock/platform/persistence";
import type { TreasuryModule } from "@bedrock/treasury";

import { createCommercialTreasuryState } from "./commercial-treasury-state";

type CreateCommercialDocumentDepsInput = Omit<
  Parameters<typeof createCommercialPluginDocumentDeps>[0],
  "treasuryState"
> & {
  db: Database;
  currenciesService: CurrenciesService;
  requisitesService: {
    findById(requisiteId: string): Promise<Requisite>;
    resolveBindings(input: {
      requisiteIds: string[];
    }): Promise<
      {
        requisiteId: string;
        bookId: string;
        organizationId: string;
        currencyCode: string;
        postingAccountNo: string;
        bookAccountInstanceId: string;
      }[]
    >;
  };
  treasuryModule: TreasuryModule;
};

export function createCommercialDocumentDeps(
  input: CreateCommercialDocumentDepsInput,
) {
  const treasuryState = createCommercialTreasuryState({
    db: input.db,
    currenciesService: input.currenciesService,
    requisitesService: input.requisitesService,
    treasuryModule: input.treasuryModule,
  });

  return createCommercialPluginDocumentDeps({
    currenciesService: input.currenciesService,
    treasuryQuotes: input.treasuryQuotes,
    treasuryState,
    ledgerReadService: input.ledgerReadService,
    requisitesService: input.requisitesService,
    partiesService: input.partiesService,
  });
}

export { createIfrsDocumentDeps };
