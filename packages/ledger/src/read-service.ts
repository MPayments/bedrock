import { createLedgerContext, type LedgerDeps } from "./internal/context";
import { createLedgerReadQueries, type LedgerReadQueries } from "./queries/read";

export type LedgerReadService = LedgerReadQueries;

export function createLedgerReadService(deps: LedgerDeps): LedgerReadService {
  const context = createLedgerContext(deps);
  return createLedgerReadQueries(context);
}
