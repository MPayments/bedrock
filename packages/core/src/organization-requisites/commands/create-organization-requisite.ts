import { and, eq, isNull, ne } from "drizzle-orm";

import { isInternalLedgerCounterparty } from "@bedrock/core/counterparties";
import type { Transaction } from "@bedrock/kernel/db/types";

import type { OrganizationRequisitesServiceContext } from "../internal/context";
import { ensureOrganizationRequisiteBindingTx } from "../internal/bindings";
import { schema } from "../schema";
import {
  CreateOrganizationRequisiteInputSchema,
  validateOrganizationRequisiteFields,
  type CreateOrganizationRequisiteInput,
  type OrganizationRequisite,
} from "../validation";
import { OrganizationRequisiteOwnerNotInternalError } from "../errors";

async function clearOtherDefaultsTx(
  tx: Transaction,
  input: {
    organizationId: string;
    currencyId: string;
    currentId: string;
  },
) {
  await tx
    .update(schema.organizationRequisites)
    .set({ isDefault: false })
    .where(
      and(
        eq(schema.organizationRequisites.organizationId, input.organizationId),
        eq(schema.organizationRequisites.currencyId, input.currencyId),
        isNull(schema.organizationRequisites.archivedAt),
        ne(schema.organizationRequisites.id, input.currentId),
      ),
    );

  await tx
    .update(schema.organizationRequisites)
    .set({ isDefault: true })
    .where(eq(schema.organizationRequisites.id, input.currentId));
}

export function createCreateOrganizationRequisiteHandler(
  context: OrganizationRequisitesServiceContext,
) {
  const { db, log } = context;

  return async function createOrganizationRequisite(
    input: CreateOrganizationRequisiteInput,
  ): Promise<OrganizationRequisite> {
    const validated = CreateOrganizationRequisiteInputSchema.parse(input);
    validateOrganizationRequisiteFields({
      kind: validated.kind,
      beneficiaryName: validated.beneficiaryName ?? null,
      institutionName: validated.institutionName ?? null,
      institutionCountry: validated.institutionCountry ?? null,
      accountNo: validated.accountNo ?? null,
      corrAccount: validated.corrAccount ?? null,
      iban: validated.iban ?? null,
      bic: validated.bic ?? null,
      swift: validated.swift ?? null,
      bankAddress: validated.bankAddress ?? null,
      network: validated.network ?? null,
      assetCode: validated.assetCode ?? null,
      address: validated.address ?? null,
      memoTag: validated.memoTag ?? null,
      accountRef: validated.accountRef ?? null,
      subaccountRef: validated.subaccountRef ?? null,
      contact: validated.contact ?? null,
      notes: validated.notes ?? null,
    });

    return db.transaction(async (tx) => {
      if (
        !(await isInternalLedgerCounterparty({
          db: tx,
          counterpartyId: validated.organizationId,
        }))
      ) {
        throw new OrganizationRequisiteOwnerNotInternalError(
          validated.organizationId,
        );
      }

      const existingRequisites = await tx
        .select({ id: schema.organizationRequisites.id })
        .from(schema.organizationRequisites)
        .where(
          and(
            eq(
              schema.organizationRequisites.organizationId,
              validated.organizationId,
            ),
            eq(schema.organizationRequisites.currencyId, validated.currencyId),
            isNull(schema.organizationRequisites.archivedAt),
          ),
        );

      const shouldBeDefault =
        validated.isDefault === true || existingRequisites.length === 0;

      const [created] = await tx
        .insert(schema.organizationRequisites)
        .values({
          organizationId: validated.organizationId,
          currencyId: validated.currencyId,
          kind: validated.kind,
          label: validated.label,
          description: validated.description ?? null,
          beneficiaryName: validated.beneficiaryName ?? null,
          institutionName: validated.institutionName ?? null,
          institutionCountry: validated.institutionCountry ?? null,
          accountNo: validated.accountNo ?? null,
          corrAccount: validated.corrAccount ?? null,
          iban: validated.iban ?? null,
          bic: validated.bic ?? null,
          swift: validated.swift ?? null,
          bankAddress: validated.bankAddress ?? null,
          network: validated.network ?? null,
          assetCode: validated.assetCode ?? null,
          address: validated.address ?? null,
          memoTag: validated.memoTag ?? null,
          accountRef: validated.accountRef ?? null,
          subaccountRef: validated.subaccountRef ?? null,
          contact: validated.contact ?? null,
          notes: validated.notes ?? null,
          isDefault: shouldBeDefault,
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create organization requisite");
      }

      if (shouldBeDefault) {
        await clearOtherDefaultsTx(tx, {
          organizationId: created.organizationId,
          currencyId: created.currencyId,
          currentId: created.id,
        });
      }

      await ensureOrganizationRequisiteBindingTx(tx, { requisiteId: created.id });

      const [fresh] = await tx
        .select()
        .from(schema.organizationRequisites)
        .where(eq(schema.organizationRequisites.id, created.id))
        .limit(1);

      log.info("Organization requisite created", {
        id: created.id,
        organizationId: created.organizationId,
      });

      return fresh!;
    });
  };
}
