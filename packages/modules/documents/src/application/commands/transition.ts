import { InvalidStateError } from "@bedrock/shared/core/errors";

import { runDocumentTransition } from "./transition-runtime";
import type { DocumentTransitionInput } from "../../contracts/commands";
import type { DocumentsServiceContext } from "../shared/context";
import { DOCUMENT_TRANSITION_SPECS } from "../shared/transition-specs";

export function createTransitionHandler(context: DocumentsServiceContext) {
  return async function transition(input: DocumentTransitionInput) {
    if (input.action === "post" || input.action === "repost") {
      throw new InvalidStateError(
        `Document action "${input.action}" requires workflow orchestration`,
      );
    }
    const spec = DOCUMENT_TRANSITION_SPECS[input.action];

    return runDocumentTransition({
      services: context,
      transition: input,
      spec,
    });
  };
}
