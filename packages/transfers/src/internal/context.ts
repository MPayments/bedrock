import type { AccountService } from "@bedrock/accounts";
import type { Database } from "@bedrock/db";
import type { Logger } from "@bedrock/kernel";
import { noopLogger } from "@bedrock/kernel";
import type { LedgerEngine } from "@bedrock/ledger";

export interface TransfersServiceDeps {
  db: Database;
  ledger: LedgerEngine;
  accountService: Pick<AccountService, "resolveTransferBindings">;
  canApprove?: (
    actorUserId: string,
    sourceCounterpartyId: string,
    destinationCounterpartyId: string,
  ) => Promise<boolean> | boolean;
  logger?: Logger;
}

export interface TransfersServiceContext {
  db: Database;
  ledger: LedgerEngine;
  accountService: Pick<AccountService, "resolveTransferBindings">;
  canApprove?: (
    actorUserId: string,
    sourceCounterpartyId: string,
    destinationCounterpartyId: string,
  ) => Promise<boolean> | boolean;
  log: Logger;
}

export function createTransfersServiceContext(
  deps: TransfersServiceDeps,
): TransfersServiceContext {
  return {
    db: deps.db,
    ledger: deps.ledger,
    accountService: deps.accountService,
    canApprove: deps.canApprove,
    log: deps.logger?.child({ service: "transfers" }) ?? noopLogger,
  };
}
