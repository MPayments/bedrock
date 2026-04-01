import type { AppContext } from "../context";

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
