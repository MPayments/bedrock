import type { Counterparty } from "../../domain/counterparty";

export interface CounterpartyRepository {
  findById(id: string): Promise<Counterparty | null>;
  findByCustomerId(customerId: string): Promise<Counterparty[]>;
  save(counterparty: Counterparty): Promise<Counterparty>;
  remove(id: string): Promise<boolean>;
}
