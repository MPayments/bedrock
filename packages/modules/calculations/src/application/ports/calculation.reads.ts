import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  Calculation,
  CalculationDetails,
} from "../contracts/dto";
import type { ListCalculationsQuery } from "../contracts/queries";

export interface CalculationReads {
  findById(id: string): Promise<CalculationDetails | null>;
  list(input: ListCalculationsQuery): Promise<PaginatedList<Calculation>>;
}
