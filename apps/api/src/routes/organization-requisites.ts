import {
  RequisiteNotFoundError,
} from "@bedrock/parties";
import type { Requisite } from "@bedrock/parties/contracts";

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
  const [currency, provider] = await Promise.all([
    ctx.currenciesService.findById(requisite.currencyId),
    ctx.partiesModule.requisites.queries.findProviderById(requisite.providerId),
  ]);

  return {
    accountNo: requisite.accountNo,
    bankAddress: provider?.address ?? null,
    bic: provider?.bic ?? null,
    corrAccount: requisite.corrAccount,
    currencyCode: currency.code,
    id: requisite.id,
    institutionName: provider?.name ?? null,
    label: requisite.label,
    ownerId: requisite.ownerId,
    swift: provider?.swift ?? null,
  };
}
