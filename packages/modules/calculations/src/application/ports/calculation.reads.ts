import type { PaginatedList } from "@bedrock/shared/core/pagination";

import type {
  Calculation,
  CalculationDetails,
} from "../contracts/dto";
import type { ListCalculationsQuery } from "../contracts/queries";

export interface CalculationReads {
  findById(id: string): Promise<CalculationDetails | null>;
  findApplicationIdByCalculationId(id: string): Promise<number | null>;
  findLatestByApplicationId(applicationId: number): Promise<Calculation | null>;
  list(input: ListCalculationsQuery): Promise<PaginatedList<Calculation>>;
  listByApplicationId(applicationId: number): Promise<Calculation[]>;
}
