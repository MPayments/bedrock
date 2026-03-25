import type { CreateCalculationInput } from "../contracts/commands";
import type { Calculation } from "../contracts/dto";

export interface CalculationStore {
  findById(id: number): Promise<Calculation | null>;
  create(input: CreateCalculationInput): Promise<Calculation>;
  updateStatus(id: number, status: string): Promise<Calculation | null>;
  remove(id: number): Promise<boolean>;
}
