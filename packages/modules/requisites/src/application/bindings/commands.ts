import {
  RequisiteAccountingBindingNotFoundError,
} from "../../errors";
import type { RequisitesServiceContext } from "../shared/context";

export function createUpsertRequisiteAccountingBindingHandler(
  context: RequisitesServiceContext,
) {
  const { bindingCommands, runInTransaction } = context;

  return async function upsertRequisiteAccountingBinding(input: {
    requisiteId: string;
    bookId: string;
    bookAccountInstanceId: string;
    postingAccountNo: string;
  }) {
    return runInTransaction(async (tx) => {
      const binding = await bindingCommands.upsertBinding(input, tx);

      if (!binding) {
        throw new RequisiteAccountingBindingNotFoundError(input.requisiteId);
      }

      return binding;
    });
  };
}
