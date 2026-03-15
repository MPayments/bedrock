import type { Transaction } from "@bedrock/platform/persistence";

import {
  UpsertOrganizationRequisiteAccountingBindingInputSchema,
  type UpsertOrganizationRequisiteAccountingBindingInput,
} from "../../contracts";
import {
  OrganizationRequisiteBindingNotFoundError,
  OrganizationRequisiteNotFoundError,
} from "../../errors";
import type { OrganizationsServiceContext } from "../shared/context";

const DEFAULT_REQUISITE_POSTING_ACCOUNT_NO = "1110";

export async function ensureOrganizationRequisiteAccountingBindingTx(
  context: OrganizationsServiceContext,
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
    throw new OrganizationRequisiteBindingNotFoundError(input.requisiteId);
  }

  return binding;
}

export function createGetOrganizationRequisiteAccountingBindingHandler(
  context: OrganizationsServiceContext,
) {
  const { requisites } = context;

  return async function getOrganizationRequisiteAccountingBinding(
    requisiteId: string,
  ) {
    const requisite = await requisites.findRequisiteById(requisiteId);

    if (!requisite) {
      throw new OrganizationRequisiteNotFoundError(requisiteId);
    }

    const binding = await requisites.findBindingByRequisiteId(requisiteId);

    if (!binding) {
      throw new OrganizationRequisiteBindingNotFoundError(requisiteId);
    }

    return binding;
  };
}

export function createResolveOrganizationRequisiteBindingsHandler(
  context: OrganizationsServiceContext,
) {
  const { log, requisites } = context;

  return async function resolveOrganizationRequisiteBindings(input: {
    requisiteIds: string[];
  }) {
    const uniqueIds = [...new Set(input.requisiteIds)];
    const rows = await requisites.listResolvedBindingsById(uniqueIds);

    if (rows.length !== uniqueIds.length) {
      const found = new Set(rows.map((row) => row.requisiteId));
      const missingId = uniqueIds.find((id) => !found.has(id)) ?? uniqueIds[0];
      throw new OrganizationRequisiteNotFoundError(missingId!);
    }

    const byId = new Map(rows.map((row) => [row.requisiteId, row]));

    log.debug("Resolved organization requisite bindings", {
      requested: input.requisiteIds.length,
      unique: uniqueIds.length,
    });

    return input.requisiteIds.map((id) => byId.get(id)!);
  };
}

export function createUpsertOrganizationRequisiteAccountingBindingHandler(
  context: OrganizationsServiceContext,
) {
  const { db, log, requisites } = context;

  return async function upsertOrganizationRequisiteAccountingBinding(
    requisiteId: string,
    input: UpsertOrganizationRequisiteAccountingBindingInput,
  ) {
    const validated =
      UpsertOrganizationRequisiteAccountingBindingInputSchema.parse(input);

    const binding = await db.transaction(async (tx) => {
      const requisite = await requisites.findRequisiteById(requisiteId, tx);

      if (!requisite) {
        throw new OrganizationRequisiteNotFoundError(requisiteId);
      }

      return ensureOrganizationRequisiteAccountingBindingTx(context, tx, {
        requisiteId,
        organizationId: requisite.ownerId,
        currencyId: requisite.currencyId,
        postingAccountNo: validated.postingAccountNo,
      });
    });

    log.info("Organization requisite accounting binding updated", { requisiteId });
    return binding;
  };
}
