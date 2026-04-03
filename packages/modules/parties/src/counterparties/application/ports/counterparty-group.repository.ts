import type { CounterpartyGroup } from "../../domain/counterparty-group";

export interface CounterpartyGroupRepository {
  findById(id: string): Promise<CounterpartyGroup | null>;
  findManagedCustomerGroup(customerId: string): Promise<CounterpartyGroup | null>;
  findByParentId(parentId: string): Promise<CounterpartyGroup[]>;
  save(group: CounterpartyGroup): Promise<CounterpartyGroup>;
  remove(id: string): Promise<boolean>;
}
