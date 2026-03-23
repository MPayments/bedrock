import { ExecuteDocumentTransitionCommand } from "./commands/transition";
import type { LifecycleServiceDeps } from "./service-deps";

export function createLifecycleService(deps: LifecycleServiceDeps) {
  const execute = new ExecuteDocumentTransitionCommand(deps);

  return {
    commands: {
      execute: execute.execute.bind(execute),
    },
  };
}
