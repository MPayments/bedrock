import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import {
  findRequisiteIdentifier,
  projectLegacyRequisiteRouting,
} from "@bedrock/parties";
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

interface RequisiteMeta {
  currency: string;
  identity: string;
  label: string;
}

function createRequisiteMeta(input: {
  accountNo?: string | null;
  accountRef?: string | null;
  address?: string | null;
  iban?: string | null;
  kind: "bank" | "blockchain" | "exchange" | "custodian";
  label: string;
  subaccountRef?: string | null;
  currency: string;
}): RequisiteMeta {
  return {
    currency: input.currency,
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
    const optionsByOrganizationId = new Map<string, Awaited<
      ReturnType<typeof ctx.partiesReadRuntime.requisitesQueries.listOptions>
    >>();

    const optionsByOrganization = await Promise.all(
      uniqueOrganizationIds.map((organizationId) =>
        ctx.partiesReadRuntime.requisitesQueries
          .listOptions({
            ownerId: organizationId,
            ownerType: "organization",
          })
          .then((options) => [organizationId, options] as const),
      ),
    );

    for (const [organizationId, options] of optionsByOrganization) {
      optionsByOrganizationId.set(organizationId, options);

      const optionRequisites = (
        await Promise.all(
          options.map((option) =>
            ctx.partiesReadRuntime.requisitesQueries.findById(option.id),
          ),
        )
      ).filter((requisite) => requisite !== null);

      for (const option of optionRequisites) {
        const routing = projectLegacyRequisiteRouting({
          provider: null,
          requisite: option,
        });
        metaById.set(
          option.id,
          createRequisiteMeta({
            accountNo: routing.accountNo,
            accountRef:
              findRequisiteIdentifier(option, "account_ref")?.value ?? null,
            address:
              findRequisiteIdentifier(option, "wallet_address")?.value ?? null,
            currency:
              options.find((item) => item.id === option.id)?.currencyCode ?? "",
            iban: routing.iban,
            kind: option.kind,
            label: option.label,
            subaccountRef:
              findRequisiteIdentifier(option, "subaccount_ref")?.value ?? null,
          }),
        );
      }
    }

    const missingRequisiteIds = uniqueRequisiteIds.filter((id) => !metaById.has(id));
    if (missingRequisiteIds.length > 0) {
      const missingRequisites = await Promise.all(
        missingRequisiteIds.map((requisiteId) =>
          ctx.partiesReadRuntime.requisitesQueries.findById(requisiteId),
        ),
      );

      for (const requisite of missingRequisites) {
        if (!requisite) {
          continue;
        }

        const routing = projectLegacyRequisiteRouting({
          provider: null,
          requisite,
        });

        metaById.set(
          requisite.id,
          createRequisiteMeta({
            accountNo: routing.accountNo,
            accountRef:
              findRequisiteIdentifier(requisite, "account_ref")?.value ?? null,
            address:
              findRequisiteIdentifier(requisite, "wallet_address")?.value ?? null,
            currency: "",
            iban: routing.iban,
            kind: requisite.kind,
            label: requisite.label,
            subaccountRef:
              findRequisiteIdentifier(requisite, "subaccount_ref")?.value ?? null,
          }),
        );
      }
    }

    return {
      metaById,
      optionsByOrganizationId,
    };
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

    const { metaById: requisiteMetaById, optionsByOrganizationId } =
      await buildRequisiteMetaById(organizationIds, []);
    const organizationIdsWithRequisites = Array.from(
      Array.from(optionsByOrganizationId.entries())
        .filter(([, options]) => options.length > 0)
        .map(([organizationId]) => organizationId),
    );

    await Promise.all(
      organizationIdsWithRequisites.map((organizationId) =>
        ctx.ledgerModule.books.commands.ensureDefaultOrganizationBook({
          organizationId,
        }),
      ),
    );

    const rows =
      await ctx.ledgerModule.balances.queries.listOrganizationRequisiteLiquidityRows({
        organizationIds,
      });
    const missingRequisiteIds = Array.from(
      new Set(
        rows
          .map((row) => row.requisiteId)
          .filter((requisiteId) => !requisiteMetaById.has(requisiteId)),
      ),
    );

    if (missingRequisiteIds.length > 0) {
      const missingRequisites = await Promise.all(
        missingRequisiteIds.map((requisiteId) =>
          ctx.partiesReadRuntime.requisitesQueries.findById(requisiteId),
        ),
      );

      for (const requisite of missingRequisites) {
        if (!requisite) {
          continue;
        }

        const routing = projectLegacyRequisiteRouting({
          provider: null,
          requisite,
        });

        requisiteMetaById.set(
          requisite.id,
          createRequisiteMeta({
            accountNo: routing.accountNo,
            accountRef:
              findRequisiteIdentifier(requisite, "account_ref")?.value ?? null,
            address:
              findRequisiteIdentifier(requisite, "wallet_address")?.value ?? null,
            currency: "",
            iban: routing.iban,
            kind: requisite.kind,
            label: requisite.label,
            subaccountRef:
              findRequisiteIdentifier(requisite, "subaccount_ref")?.value ?? null,
          }),
        );
      }
    }

    const zeroRows = Array.from(optionsByOrganizationId.entries()).flatMap(
      ([organizationId, options]) =>
        options
          .filter(
            (option) =>
              !rows.some(
                (row) =>
                  row.organizationId === organizationId &&
                  row.requisiteId === option.id &&
                  row.currency === option.currencyCode,
              ),
          )
          .map((option) => ({
            organizationId,
            requisiteId: option.id,
            currency: option.currencyCode,
            ledgerBalanceMinor: "0",
            availableMinor: "0",
            reservedMinor: "0",
            pendingMinor: "0",
          })),
    );
    const allRows = [...rows, ...zeroRows];

    if (allRows.length === 0) {
      return jsonOk(c, { asOf, data: [] });
    }

    const data = allRows
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
