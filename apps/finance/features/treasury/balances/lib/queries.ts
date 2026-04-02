import { z } from "zod";

import { getServerApiClient } from "@/lib/api/server-client";
import { readJsonWithSchema, requestOk } from "@/lib/api/response";

const TreasuryOrganizationBalanceRowSchema = z.object({
  organizationId: z.uuid(),
  organizationName: z.string(),
  requisiteId: z.uuid(),
  requisiteLabel: z.string(),
  requisiteIdentity: z.string(),
  currency: z.string(),
  ledgerBalance: z.string(),
  available: z.string(),
  reserved: z.string(),
  pending: z.string(),
});

const TreasuryOrganizationBalancesResponseSchema = z.object({
  asOf: z.iso.datetime(),
  data: z.array(TreasuryOrganizationBalanceRowSchema),
});

export type TreasuryOrganizationBalanceRow = z.infer<
  typeof TreasuryOrganizationBalanceRowSchema
>;
export type TreasuryOrganizationBalancesSnapshot = z.infer<
  typeof TreasuryOrganizationBalancesResponseSchema
>;

export async function getTreasuryOrganizationBalances(): Promise<TreasuryOrganizationBalancesSnapshot> {
  const client = await getServerApiClient();
  const response = await requestOk(
    await client.v1.treasury.organizations.balances.$get(),
    "Не удалось загрузить balances treasury-организаций",
  );

  return readJsonWithSchema(
    response,
    TreasuryOrganizationBalancesResponseSchema,
  );
}
