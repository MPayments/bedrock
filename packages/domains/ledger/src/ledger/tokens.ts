import { token } from "@bedrock/core";

import type { LedgerEngine } from "../ledger/engine";
import type { LedgerReadService } from "../ledger/read-service";

export const LedgerEngineToken = token<LedgerEngine>(
  "multihansa.ledger.engine",
);

export const LedgerReadServiceToken = token<LedgerReadService>(
  "multihansa.ledger.read-service",
);
