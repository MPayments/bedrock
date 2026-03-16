import {
  ListRequisiteOptionsQuerySchema,
  ListRequisitesQuerySchema,
  type ListRequisiteOptionsQuery,
  type ListRequisitesQuery,
  type Requisite,
} from "../../contracts";
import { buildRequisiteDisplayLabel } from "../../domain/requisite-details";
import { RequisiteNotFoundError } from "../../errors";
import type { RequisitesServiceContext } from "../shared/context";

export function createListRequisitesHandler(context: RequisitesServiceContext) {
  const { requisiteQueries } = context;

  return async function listRequisites(input?: ListRequisitesQuery) {
    const query = ListRequisitesQuerySchema.parse(input ?? {});
    return requisiteQueries.listRequisites(query);
  };
}

export function createFindRequisiteByIdHandler(
  context: RequisitesServiceContext,
) {
  const { requisiteQueries } = context;

  return async function findRequisiteById(id: string): Promise<Requisite> {
    const requisite = await requisiteQueries.findActiveRequisiteById(id);

    if (!requisite) {
      throw new RequisiteNotFoundError(id);
    }

    return requisite;
  };
}

export function createListRequisiteOptionsHandler(
  context: RequisitesServiceContext,
) {
  const { requisiteQueries } = context;

  return async function listRequisiteOptions(
    input?: ListRequisiteOptionsQuery,
  ) {
    const query = ListRequisiteOptionsQuerySchema.parse(input ?? {});
    const rows = await requisiteQueries.listRequisiteOptions(query);

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
        institutionCountry: row.institutionCountry,
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
  };
}
