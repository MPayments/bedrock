import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { minorToAmountString } from "@bedrock/shared/money";
import { resolveRequisiteIdentity } from "@bedrock/shared/requisites";

import { jsonOk } from "../common/response";
import type { AppContext } from "../context";
import type { AuthVariables } from "../middleware/auth";
import { requirePermission } from "../middleware/permission";

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

type RequisiteMeta = {
  identity: string;
  label: string;
};

function createRequisiteMeta(input: {
  accountNo?: string | null;
  accountRef?: string | null;
  address?: string | null;
  iban?: string | null;
  kind: "bank" | "blockchain" | "exchange" | "custodian";
  label: string;
  subaccountRef?: string | null;
}): RequisiteMeta {
  return {
    label: input.label,
    identity:
      resolveRequisiteIdentity({
        accountNo: input.accountNo ?? "",
        accountRef: input.accountRef ?? "",
        address: input.address ?? "",
        iban: input.iban ?? "",
        kind: input.kind,
        subaccountRef: input.subaccountRef ?? "",
      }) || "—",
  };
}

export function treasuryOrganizationBalancesRoutes(ctx: AppContext) {
  const app = new OpenAPIHono<{ Variables: AuthVariables }>();

  async function buildRequisiteMetaById(
    organizationIds: string[],
    requisiteIds: string[],
  ) {
    const uniqueOrganizationIds = Array.from(
      new Set(organizationIds.filter(Boolean)),
    );
    const uniqueRequisiteIds = Array.from(new Set(requisiteIds.filter(Boolean)));
    const metaById = new Map<string, RequisiteMeta>();

    const optionsByOrganization = await Promise.all(
      uniqueOrganizationIds.map((organizationId) =>
        ctx.partiesReadRuntime.requisitesQueries.listOptions({
          ownerId: organizationId,
          ownerType: "organization",
        }),
      ),
    );

    for (const option of optionsByOrganization.flat()) {
      metaById.set(
        option.id,
        createRequisiteMeta({
          accountNo: option.accountNo,
          accountRef: option.accountRef,
          address: option.address,
          iban: option.iban,
          kind: option.kind,
          label: option.label,
          subaccountRef: option.subaccountRef,
        }),
      );
    }

    const missingRequisiteIds = uniqueRequisiteIds.filter((id) => !metaById.has(id));
    if (missingRequisiteIds.length === 0) {
      return metaById;
    }

    const missingRequisites = await Promise.all(
      missingRequisiteIds.map((requisiteId) =>
        ctx.partiesReadRuntime.requisitesQueries.findById(requisiteId),
      ),
    );

    for (const requisite of missingRequisites) {
      if (!requisite) {
        continue;
      }

      metaById.set(
        requisite.id,
        createRequisiteMeta({
          accountNo: requisite.accountNo,
          accountRef: requisite.accountRef,
          address: requisite.address,
          iban: requisite.iban,
          kind: requisite.kind,
          label: requisite.label,
          subaccountRef: requisite.subaccountRef,
        }),
      );
    }

    return metaById;
  }

  const listRoute = createRoute({
    middleware: [requirePermission({ balances: ["get"] })],
    method: "get",
    path: "/",
    tags: ["Treasury"],
    summary: "List treasury organization balances",
    responses: {
      200: {
        description: "Current treasury organization balance snapshot",
        content: {
          "application/json": {
            schema: TreasuryOrganizationBalancesResponseSchema,
          },
        },
      },
    },
  });

  return app.openapi(listRoute, async (c) => {
    const asOf = new Date().toISOString();
    const organizations =
      await ctx.partiesReadRuntime.organizationsQueries.listInternalLedgerOrganizations();
    const organizationNameById = new Map(
      organizations.map((organization) => [organization.id, organization.shortName]),
    );
    const organizationIds = organizations.map((organization) => organization.id);

    if (organizationIds.length === 0) {
      return jsonOk(c, {
        asOf,
        data: [],
      });
    }

    const rows =
      await ctx.ledgerModule.balances.queries.listOrganizationRequisiteLiquidityRows({
        organizationIds,
      });

    if (rows.length === 0) {
      return jsonOk(c, { asOf, data: [] });
    }

    const requisiteMetaById = await buildRequisiteMetaById(
      organizationIds,
      rows.map((row) => row.requisiteId),
    );

    const data = rows
      .map((row) => {
        const requisiteMeta = requisiteMetaById.get(row.requisiteId);

        return {
          organizationId: row.organizationId,
          organizationName:
            organizationNameById.get(row.organizationId) ?? row.organizationId,
          requisiteId: row.requisiteId,
          requisiteLabel: requisiteMeta?.label ?? row.requisiteId,
          requisiteIdentity: requisiteMeta?.identity ?? "—",
          currency: row.currency,
          ledgerBalance: minorToAmountString(row.ledgerBalanceMinor, {
            currency: row.currency,
          }),
          available: minorToAmountString(row.availableMinor, {
            currency: row.currency,
          }),
          reserved: minorToAmountString(row.reservedMinor, {
            currency: row.currency,
          }),
          pending: minorToAmountString(row.pendingMinor, {
            currency: row.currency,
          }),
        };
      })
      .sort((left, right) => {
        const organizationCompare = left.organizationName.localeCompare(
          right.organizationName,
          "ru",
        );

        if (organizationCompare !== 0) {
          return organizationCompare;
        }

        const currencyCompare = left.currency.localeCompare(right.currency, "en");
        if (currencyCompare !== 0) {
          return currencyCompare;
        }

        return left.requisiteLabel.localeCompare(right.requisiteLabel, "ru");
      });

    return jsonOk(c, { asOf, data });
  });
}
