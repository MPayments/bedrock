import {
  ExplainReconciliationMatchInputSchema,
  ListReconciliationExceptionsInputSchema,
  type ListReconciliationExceptionsInput,
  type ReconciliationExceptionListItemDto,
  type ReconciliationMatchExplanation,
} from "../../contracts";
import { ReconciliationMatchNotFoundError } from "../../errors";
import { toReconciliationExceptionListItemDto } from "../mappers";
import type { ReconciliationServiceContext } from "../shared/context";

export function createListExceptionsHandler(
  context: ReconciliationServiceContext,
) {
  const { exceptions } = context;

  return async function listExceptions(
    input?: Partial<ListReconciliationExceptionsInput>,
  ): Promise<ReconciliationExceptionListItemDto[]> {
    const validated = ListReconciliationExceptionsInputSchema.parse(input);
    const rows = await exceptions.list(validated);

    return rows.map(toReconciliationExceptionListItemDto);
  };
}

export function createExplainMatchHandler(
  context: ReconciliationServiceContext,
) {
  const { matches } = context;

  return async function explainMatch(
    matchId: string,
  ): Promise<ReconciliationMatchExplanation> {
    const validated = ExplainReconciliationMatchInputSchema.parse({ matchId });
    const match = await matches.findById(validated.matchId);

    if (!match) {
      throw new ReconciliationMatchNotFoundError(validated.matchId);
    }

    return match.explanation;
  };
}
