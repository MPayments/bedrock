import {
  RequisiteBindingNotFoundError,
  RequisiteBindingOwnerTypeError,
  RequisiteNotFoundError,
} from "../../errors";
import {
  UpsertRequisiteAccountingBindingInputSchema,
  type UpsertRequisiteAccountingBindingInput,
} from "../../contracts";
import type { Transaction } from "@bedrock/platform/persistence";
import type { RequisitesServiceContext } from "../shared/context";

const DEFAULT_REQUISITE_POSTING_ACCOUNT_NO = "1110";

export async function ensureRequisiteAccountingBindingTx(
  context: RequisitesServiceContext,
  tx: Transaction,
  input: {
    requisiteId: string;
    organizationId: string;
    currencyId: string;
    postingAccountNo?: string;
  },
) {
  const postingAccountNo =
    input.postingAccountNo ?? DEFAULT_REQUISITE_POSTING_ACCOUNT_NO;
  const currencyCodes = await context.currencies.listCodesById([input.currencyId]);
  const currencyCode = currencyCodes.get(input.currencyId);

  if (!currencyCode) {
    await context.currencies.assertCurrencyExists(input.currencyId);
    throw new Error(`Currency code not found for ${input.currencyId}`);
  }

  const postingTarget = await context.ledgerBindings.ensureOrganizationPostingTarget(
    tx,
    {
      organizationId: input.organizationId,
      currencyCode,
      postingAccountNo,
    },
  );

  const binding = await context.requisites.upsertBindingTx(tx, {
    requisiteId: input.requisiteId,
    bookId: postingTarget.bookId,
    bookAccountInstanceId: postingTarget.bookAccountInstanceId,
    postingAccountNo,
  });

  if (!binding) {
    throw new RequisiteBindingNotFoundError(input.requisiteId);
  }

  return binding;
}

export function createGetRequisiteAccountingBindingHandler(
  context: RequisitesServiceContext,
) {
  const { requisites } = context;

  return async function getRequisiteAccountingBinding(requisiteId: string) {
    const requisite = await requisites.findRequisiteById(requisiteId);

    if (!requisite) {
      throw new RequisiteNotFoundError(requisiteId);
    }

    if (requisite.ownerType !== "organization") {
      throw new RequisiteBindingOwnerTypeError(requisiteId);
    }

    const binding = await requisites.findBindingByRequisiteId(requisiteId);

    if (!binding) {
      throw new RequisiteBindingNotFoundError(requisiteId);
    }

    return binding;
  };
}

export function createResolveRequisiteBindingsHandler(
  context: RequisitesServiceContext,
) {
  const { log, requisites } = context;

  return async function resolveRequisiteBindings(input: { requisiteIds: string[] }) {
    const uniqueIds = [...new Set(input.requisiteIds)];
    const rows = await requisites.listResolvedBindingsById(uniqueIds);

    if (rows.length !== uniqueIds.length) {
      const found = new Set(rows.map((row) => row.requisiteId));
      const missingId = uniqueIds.find((id) => !found.has(id)) ?? uniqueIds[0];
      throw new RequisiteNotFoundError(missingId!);
    }

    const byId = new Map(rows.map((row) => [row.requisiteId, row]));

    log.debug("Resolved requisite bindings", {
      requested: input.requisiteIds.length,
      unique: uniqueIds.length,
    });

    return input.requisiteIds.map((id) => byId.get(id)!);
  };
}

export function createUpsertRequisiteAccountingBindingHandler(
  context: RequisitesServiceContext,
) {
  const { db, log, requisites } = context;

  return async function upsertRequisiteAccountingBinding(
    requisiteId: string,
    input: UpsertRequisiteAccountingBindingInput,
  ) {
    const validated = UpsertRequisiteAccountingBindingInputSchema.parse(input);
    const binding = await db.transaction(async (tx) => {
      const requisite = await requisites.findRequisiteById(requisiteId, tx);

      if (!requisite) {
        throw new RequisiteNotFoundError(requisiteId);
      }

      if (requisite.ownerType !== "organization") {
        throw new RequisiteBindingOwnerTypeError(requisiteId);
      }

        return ensureRequisiteAccountingBindingTx(context, tx, {
          requisiteId,
          organizationId: requisite.ownerId,
          currencyId: requisite.currencyId,
          postingAccountNo: validated.postingAccountNo,
        });
      });

    log.info("Requisite accounting binding updated", { requisiteId });
    return binding;
  };
}
