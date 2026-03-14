import { runDocumentTransition } from "./transition-runtime";
import type { DocumentTransitionInput } from "../../contracts/service";
import type { DocumentsServiceContext } from "../shared/context";
import { DOCUMENT_TRANSITION_SPECS } from "../shared/transition-specs";


export function createTransitionHandler(context: DocumentsServiceContext) {
  return async function transition(input: DocumentTransitionInput) {
    return runDocumentTransition({
      services: context,
      transition: input,
      spec: DOCUMENT_TRANSITION_SPECS[input.action],
    });
  };
}
