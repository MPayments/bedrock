import { eq } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import { opsAgentOrganizationBankDetails } from "../../../infra/drizzle/schema/agents";
import type {
  CreateBankDetailsInput,
  UpdateBankDetailsInput,
} from "../../application/contracts/bank-details-commands";
import type { BankDetails } from "../../application/contracts/bank-details-dto";
import type { BankDetailsStore } from "../../application/ports/bank-details.store";

export class DrizzleBankDetailsStore implements BankDetailsStore {
  constructor(private readonly db: Queryable) {}

  async findById(id: number): Promise<BankDetails | null> {
    const [row] = await this.db
      .select()
      .from(opsAgentOrganizationBankDetails)
      .where(eq(opsAgentOrganizationBankDetails.id, id))
      .limit(1);
    return (row as BankDetails) ?? null;
  }

  async create(input: CreateBankDetailsInput): Promise<BankDetails> {
    const [created] = await this.db
      .insert(opsAgentOrganizationBankDetails)
      .values({
        organizationId: input.organizationId,
        name: input.name,
        nameI18n: input.nameI18n,
        bankName: input.bankName,
        bankNameI18n: input.bankNameI18n,
        bankAddress: input.bankAddress,
        bankAddressI18n: input.bankAddressI18n,
        account: input.account,
        bic: input.bic,
        corrAccount: input.corrAccount,
        swiftCode: input.swiftCode,
        currencyCode: input.currencyCode,
      })
      .returning();
    return created! as BankDetails;
  }

  async update(input: UpdateBankDetailsInput): Promise<BankDetails | null> {
    const values: Record<string, unknown> = {};

    if (input.name !== undefined) values.name = input.name;
    if (input.nameI18n !== undefined) values.nameI18n = input.nameI18n;
    if (input.bankName !== undefined) values.bankName = input.bankName;
    if (input.bankNameI18n !== undefined)
      values.bankNameI18n = input.bankNameI18n;
    if (input.bankAddress !== undefined) values.bankAddress = input.bankAddress;
    if (input.bankAddressI18n !== undefined)
      values.bankAddressI18n = input.bankAddressI18n;
    if (input.account !== undefined) values.account = input.account;
    if (input.bic !== undefined) values.bic = input.bic;
    if (input.corrAccount !== undefined) values.corrAccount = input.corrAccount;
    if (input.swiftCode !== undefined) values.swiftCode = input.swiftCode;
    if (input.currencyCode !== undefined)
      values.currencyCode = input.currencyCode;

    const [updated] = await this.db
      .update(opsAgentOrganizationBankDetails)
      .set(values)
      .where(eq(opsAgentOrganizationBankDetails.id, input.id))
      .returning();
    return (updated as BankDetails) ?? null;
  }

  async softDelete(id: number): Promise<boolean> {
    const [row] = await this.db
      .update(opsAgentOrganizationBankDetails)
      .set({ isActive: false })
      .where(eq(opsAgentOrganizationBankDetails.id, id))
      .returning({ id: opsAgentOrganizationBankDetails.id });
    return Boolean(row);
  }

  async restore(id: number): Promise<boolean> {
    const [row] = await this.db
      .update(opsAgentOrganizationBankDetails)
      .set({ isActive: true })
      .where(eq(opsAgentOrganizationBankDetails.id, id))
      .returning({ id: opsAgentOrganizationBankDetails.id });
    return Boolean(row);
  }
}
