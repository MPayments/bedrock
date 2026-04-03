import type { ModuleRuntime } from "@bedrock/shared/core";

import { EnsureBookAccountInstanceCommand } from "./commands/ensure-book-account-instance";
import type { BookAccountsCommandUnitOfWork } from "./ports/book-accounts.uow";

export interface BookAccountsServiceDeps {
  runtime: ModuleRuntime;
  commandUow: BookAccountsCommandUnitOfWork;
}

export function createBookAccountsService(
  deps: BookAccountsServiceDeps,
) {
  const ensureBookAccountInstance = new EnsureBookAccountInstanceCommand(
    deps.runtime,
    deps.commandUow,
  );

  return {
    commands: {
      ensureBookAccountInstance:
        ensureBookAccountInstance.execute.bind(ensureBookAccountInstance),
    },
  };
}

export type BookAccountsService = ReturnType<
  typeof createBookAccountsService
>;
