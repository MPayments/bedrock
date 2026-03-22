import type { ModuleRuntime } from "@bedrock/shared/core";

import { CommitOperationCommand } from "./commands/commit-operation";
import type { LedgerOperationsReads } from "./ports/operations.reads";
import type { OperationsCommandUnitOfWork } from "./ports/operations.uow";
import { GetOperationDetailsQuery } from "./queries/get-operation-details";
import { ListOperationDetailsQuery } from "./queries/list-operation-details";
import { ListOperationsQuery } from "./queries/list-operations";
import type { InternalLedgerBookGuard } from "../../shared/application/internal-ledger-book-guard";
import type { SettlementIdentityPolicy } from "../../shared/application/settlement-identity";

export interface OperationsServiceDeps {
  runtime: ModuleRuntime;
  reads: LedgerOperationsReads;
  commandUow: OperationsCommandUnitOfWork;
  settlementIdentity: SettlementIdentityPolicy;
  assertInternalLedgerBooks?: InternalLedgerBookGuard;
}

export function createOperationsService(deps: OperationsServiceDeps) {
  const commit = new CommitOperationCommand(
    deps.runtime,
    deps.commandUow,
    deps.settlementIdentity,
    deps.assertInternalLedgerBooks,
  );
  const list = new ListOperationsQuery(deps.reads);
  const listDetails = new ListOperationDetailsQuery(deps.reads);
  const getDetails = new GetOperationDetailsQuery(deps.reads);

  return {
    commands: {
      commit: commit.execute.bind(commit),
    },
    queries: {
      list: list.execute.bind(list),
      listDetails: listDetails.execute.bind(listDetails),
      getDetails: getDetails.execute.bind(getDetails),
    },
  };
}

export type OperationsService = ReturnType<typeof createOperationsService>;
