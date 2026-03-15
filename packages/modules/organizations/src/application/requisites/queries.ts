import { buildRequisiteDisplayLabel } from "@bedrock/shared/requisites";

import {
  ListOrganizationRequisiteOptionsQuerySchema,
  ListOrganizationRequisitesQuerySchema,
  type ListOrganizationRequisiteOptionsQuery,
  type ListOrganizationRequisitesQuery,
  type OrganizationRequisite,
} from "../../contracts";
import { OrganizationRequisiteNotFoundError } from "../../errors";
import type { OrganizationsServiceContext } from "../shared/context";

export function createListOrganizationRequisitesHandler(
  context: OrganizationsServiceContext,
) {
  const { requisiteQueries } = context;

  return async function listOrganizationRequisites(
    input?: ListOrganizationRequisitesQuery,
  ) {
    const query = ListOrganizationRequisitesQuerySchema.parse(input ?? {});
    return requisiteQueries.listRequisites(query);
  };
}

export function createFindOrganizationRequisiteByIdHandler(
  context: OrganizationsServiceContext,
) {
  const { requisiteQueries } = context;

  return async function findOrganizationRequisiteById(
    id: string,
  ): Promise<OrganizationRequisite> {
    const requisite = await requisiteQueries.findActiveRequisiteById(id);

    if (!requisite) {
      throw new OrganizationRequisiteNotFoundError(id);
    }

    return requisite;
  };
}

export function createListOrganizationRequisiteOptionsHandler(
  context: OrganizationsServiceContext,
) {
  const { requisiteQueries } = context;

  return async function listOrganizationRequisiteOptions(
    input?: ListOrganizationRequisiteOptionsQuery,
  ) {
    const query = ListOrganizationRequisiteOptionsQuerySchema.parse(
      input ?? {},
    );
    const rows = await requisiteQueries.listRequisiteOptions(query);

    return rows.map((row) => ({
      id: row.id,
      ownerType: "organization" as const,
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
