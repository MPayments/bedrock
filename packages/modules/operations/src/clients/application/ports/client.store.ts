import type { CreateClientInput, UpdateClientInput } from "../contracts/commands";
import type { Client } from "../contracts/dto";

export interface ClientStore {
  findById(id: number): Promise<Client | null>;
  create(input: CreateClientInput): Promise<Client>;
  update(input: UpdateClientInput): Promise<Client | null>;
  softDelete(id: number): Promise<boolean>;
  restore(id: number): Promise<boolean>;
}
