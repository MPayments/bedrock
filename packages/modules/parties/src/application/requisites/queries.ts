import { buildRequisiteDisplayLabel } from "@bedrock/shared/requisites";

import {
  ListCounterpartyRequisiteOptionsQuerySchema,
  ListCounterpartyRequisitesQuerySchema,
  type CounterpartyRequisite,
  type ListCounterpartyRequisiteOptionsQuery,
  type ListCounterpartyRequisitesQuery,
} from "../../contracts";
import { CounterpartyRequisiteNotFoundError } from "../../errors";
import type { PartiesServiceContext } from "../shared/context";

export function createListCounterpartyRequisitesHandler(
  context: PartiesServiceContext,
) {
  const { requisiteQueries } = context;

  return async function listCounterpartyRequisites(
    input?: ListCounterpartyRequisitesQuery,
  ) {
    const query = ListCounterpartyRequisitesQuerySchema.parse(input ?? {});
    return requisiteQueries.listRequisites(query);
  };
}

export function createFindCounterpartyRequisiteByIdHandler(
  context: PartiesServiceContext,
) {
  const { requisiteQueries } = context;

  return async function findCounterpartyRequisiteById(
    id: string,
  ): Promise<CounterpartyRequisite> {
    const requisite = await requisiteQueries.findActiveRequisiteById(id);

    if (!requisite) {
      throw new CounterpartyRequisiteNotFoundError(id);
    }

    return requisite;
  };
}

export function createListCounterpartyRequisiteOptionsHandler(
  context: PartiesServiceContext,
) {
  const { requisiteQueries } = context;

  return async function listCounterpartyRequisiteOptions(
    input?: ListCounterpartyRequisiteOptionsQuery,
  ) {
    const query = ListCounterpartyRequisiteOptionsQuerySchema.parse(
      input ?? {},
    );
    const rows = await requisiteQueries.listRequisiteOptions(query);

    return rows.map((row) => ({
      id: row.id,
      ownerType: "counterparty" as const,
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
