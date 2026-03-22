import {
  readRequiredBookId,
  resolveBookIdContext,
  resolvePostingPlan,
  type CompiledPack,
  type ResolvePostingPlanInput,
} from "../../domain";
import {
  ResolvePostingPlanInputSchema,
  type ResolvePostingPlanQueryInput,
} from "../contracts/queries";
import { rethrowAccountingPacksDomainError } from "../map-domain-error";
import type { InternalLedgerOrganizationsPort } from "../ports/internal-ledger-organizations.port";

export class ResolvePostingPlanQuery {
  constructor(
    private readonly loadActivePackForBook: (input?: {
      bookId?: string;
      at?: Date;
    }) => Promise<CompiledPack>,
    private readonly internalLedgerOrganizations?: InternalLedgerOrganizationsPort,
  ) {}

  async execute(input: ResolvePostingPlanInput | ResolvePostingPlanQueryInput) {
    const validated = ResolvePostingPlanInputSchema.parse(
      input,
    ) as ResolvePostingPlanInput;

    try {
      const bookId = resolveBookIdContext(validated);

      if (this.internalLedgerOrganizations) {
        const requestBookIds = Array.from(
          new Set(
            validated.plan.requests.map((request) =>
              readRequiredBookId(request),
            ),
          ),
        );
        await this.internalLedgerOrganizations.assertBooksBelongToInternalLedgerOrganizations(
          requestBookIds,
        );
      }

      const pack =
        validated.pack ??
        (await this.loadActivePackForBook({
          bookId,
          at: validated.at ?? validated.postingDate,
        }));

      return resolvePostingPlan(validated, pack);
    } catch (error) {
      rethrowAccountingPacksDomainError(error);
    }
  }
}
