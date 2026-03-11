import { defineProvider, type Provider } from "@bedrock/core";

import { DbToken } from "@multihansa/common/bedrock";
import { createLedgerEngine } from "../ledger/engine";
import { createLedgerReadService } from "../ledger/read-service";

import {
  LedgerEngineToken,
  LedgerReadServiceToken,
} from "./tokens";

export function createLedgerBedrockProviders(): Provider[] {
  return [
    defineProvider({
      provide: LedgerEngineToken,
      scope: "singleton",
      deps: {
        db: DbToken,
      },
      useFactory: ({ db }) => createLedgerEngine({ db }),
    }),
    defineProvider({
      provide: LedgerReadServiceToken,
      scope: "singleton",
      deps: {
        db: DbToken,
      },
      useFactory: ({ db }) => createLedgerReadService({ db }),
    }),
  ];
}
