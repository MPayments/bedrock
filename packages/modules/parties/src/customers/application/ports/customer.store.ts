import type { Customer } from "../contracts/dto";

export type CustomerWriteInput = Omit<Customer, "createdAt" | "updatedAt">;

export interface CustomerStore {
  findById(id: string): Promise<Customer | null>;
  create(customer: CustomerWriteInput): Promise<Customer>;
  update(customer: CustomerWriteInput): Promise<Customer | null>;
  remove(id: string): Promise<boolean>;
}
