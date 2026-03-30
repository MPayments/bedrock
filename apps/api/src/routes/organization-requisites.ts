import {
  RequisiteNotFoundError,
  type Requisite,
} from "@bedrock/parties";

import type { AppContext } from "../context";

export async function findOrganizationBankRequisite(
  ctx: AppContext,
  requisiteId: string,
): Promise<Requisite | null> {
  try {
    const requisite = await ctx.partiesModule.requisites.queries.findById(
      requisiteId,
    );
    if (
      requisite.ownerType !== "organization" ||
      requisite.kind !== "bank"
    ) {
      return null;
    }

    return requisite;
  } catch (error) {
    if (error instanceof RequisiteNotFoundError) {
      return null;
    }

    throw error;
  }
}

export async function getOrganizationBankRequisiteOrThrow(
  ctx: AppContext,
  requisiteId: string,
): Promise<Requisite> {
  const requisite = await findOrganizationBankRequisite(ctx, requisiteId);
  if (!requisite) {
    throw new RequisiteNotFoundError(requisiteId);
  }

  return requisite;
}

export async function countOrganizationBankRequisites(
  ctx: AppContext,
  organizationId: string,
): Promise<number> {
  const result = await ctx.partiesModule.requisites.queries.list({
    kind: ["bank"],
    limit: 1,
    offset: 0,
    ownerId: organizationId,
    ownerType: "organization",
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  return result.total;
}

export async function serializeOrganizationRequisiteForDocuments(
  ctx: AppContext,
  requisite: Requisite,
) {
  const currency = await ctx.currenciesService.findById(requisite.currencyId);

  return {
    accountNo: requisite.accountNo,
    bankAddress: requisite.bankAddress,
    bic: requisite.bic,
    corrAccount: requisite.corrAccount,
    currencyCode: currency.code,
    id: requisite.id,
    institutionName: requisite.institutionName,
    label: requisite.label,
    ownerId: requisite.ownerId,
    swift: requisite.swift,
  };
}
