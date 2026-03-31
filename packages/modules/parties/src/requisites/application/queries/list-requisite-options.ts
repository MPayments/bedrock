import { buildRequisiteDisplayLabel } from "../../domain/requisite-details";
import {
  ListRequisiteOptionsQuerySchema,
  type ListRequisiteOptionsInput,
} from "../contracts/requisites";
import type { RequisiteReads } from "../ports/requisite.reads";

export class ListRequisiteOptionsQuery {
  constructor(private readonly reads: RequisiteReads) {}

  async execute(input?: ListRequisiteOptionsInput) {
    const query = ListRequisiteOptionsQuerySchema.parse(input ?? {});
    const rows = await this.reads.listOptions(query);

    return rows.map((row) => ({
      id: row.id,
      ownerType: row.ownerType,
      ownerId: row.ownerId,
      currencyId: row.currencyId,
      providerId: row.providerId,
      kind: row.kind,
      label: buildRequisiteDisplayLabel({
        kind: row.kind,
        label: row.label,
        beneficiaryName: row.beneficiaryName,
        institutionName: row.institutionName,
        accountNo: row.accountNo,
        corrAccount: row.corrAccount,
        iban: row.iban,
        bic: row.bic,
        swift: row.swift,
        bankAddress: row.bankAddress,
        network: row.network,
        assetCode: row.assetCode,
        address: row.address,
        memoTag: row.memoTag,
        accountRef: row.accountRef,
        subaccountRef: row.subaccountRef,
        contact: row.contact,
        notes: row.notes,
        currencyCode: row.currencyCode,
      }),
    }));
  }
}
