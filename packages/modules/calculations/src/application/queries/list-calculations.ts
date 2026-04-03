import {
  ListCalculationsQuerySchema,
  type ListCalculationsQuery as ListCalculationsQueryInput,
} from "../contracts/queries";
import type { CalculationReads } from "../ports/calculation.reads";

export class ListCalculationsQuery {
  constructor(private readonly reads: CalculationReads) {}

  async execute(input?: ListCalculationsQueryInput) {
    const validated = ListCalculationsQuerySchema.parse(input ?? {});
    return this.reads.list(validated);
  }
}
