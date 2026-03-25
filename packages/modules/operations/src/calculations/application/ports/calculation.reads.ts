import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type { Calculation } from "../contracts/dto";
import type { ListCalculationsQuery } from "../contracts/queries";

export interface CalculationReads {
  findById(id: number): Promise<Calculation | null>;
  findByApplicationId(applicationId: number): Promise<Calculation[]>;
  findLatestByApplicationId(
    applicationId: number,
  ): Promise<Calculation | null>;
  list(input: ListCalculationsQuery): Promise<PaginatedList<Calculation>>;
}
