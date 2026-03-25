import type { Contract } from "../contracts/dto";
import type { CreateContractInput, UpdateContractInput } from "../contracts/commands";

export interface ContractStore {
  findById(id: number): Promise<Contract | null>;
  findByClientId(clientId: number): Promise<Contract | null>;
  findByContractNumber(contractNumber: string): Promise<Contract | null>;
  create(input: CreateContractInput): Promise<Contract>;
  update(input: UpdateContractInput): Promise<Contract | null>;
  softDelete(id: number): Promise<boolean>;
  restore(id: number): Promise<boolean>;
}
