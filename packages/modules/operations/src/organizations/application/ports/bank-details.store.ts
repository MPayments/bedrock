import type { BankDetails } from "../contracts/bank-details-dto";
import type {
  CreateBankDetailsInput,
  UpdateBankDetailsInput,
} from "../contracts/bank-details-commands";

export interface BankDetailsStore {
  findById(id: number): Promise<BankDetails | null>;
  create(input: CreateBankDetailsInput): Promise<BankDetails>;
  update(input: UpdateBankDetailsInput): Promise<BankDetails | null>;
  softDelete(id: number): Promise<boolean>;
  restore(id: number): Promise<boolean>;
}
