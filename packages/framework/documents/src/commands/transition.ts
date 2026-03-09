import { runDocumentTransition } from "./transition-runtime";
import type { DocumentsServiceContext } from "../internal/context";
import { DOCUMENT_TRANSITION_SPECS } from "../internal/transition-specs";
import type { DocumentTransitionInput } from "../types";


export function createTransitionHandler(context: DocumentsServiceContext) {
  return async function transition(input: DocumentTransitionInput) {
    return runDocumentTransition({
      services: context,
      transition: input,
      spec: DOCUMENT_TRANSITION_SPECS[input.action],
    });
  };
}
