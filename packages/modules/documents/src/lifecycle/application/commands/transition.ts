import { InvalidStateError } from "@bedrock/shared/core/errors";

import { runDocumentTransition } from "./transition-runtime";
import type { DocumentTransitionInput } from "../contracts/commands";
import type { LifecycleServiceDeps } from "../service-deps";
import { DOCUMENT_TRANSITION_SPECS } from "../shared/transition-specs";

export class ExecuteDocumentTransitionCommand {
  constructor(private readonly deps: LifecycleServiceDeps) {}

  async execute(input: DocumentTransitionInput) {
    if (input.action === "post" || input.action === "repost") {
      throw new InvalidStateError(
        `Document action "${input.action}" requires workflow orchestration`,
      );
    }
    const spec = DOCUMENT_TRANSITION_SPECS[input.action];

    return runDocumentTransition({
      services: this.deps,
      transition: input,
      spec,
    });
  }
}
