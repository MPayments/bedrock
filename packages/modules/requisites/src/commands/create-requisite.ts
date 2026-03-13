import { and, eq, isNull, ne } from "drizzle-orm";

import { CounterpartyNotFoundError } from "@bedrock/counterparties";
import { OrganizationNotFoundError } from "@bedrock/organizations";
import type { Transaction } from "@bedrock/persistence";

import { RequisiteNotFoundError, RequisiteProviderNotActiveError } from "../errors";
import { ensureRequisiteAccountingBindingTx } from "../internal/bindings";
import type { RequisitesServiceContext } from "../internal/context";
import { toPublicRequisite } from "../internal/shape";
import { schema } from "../schema";
import {
  CreateRequisiteInputSchema,
  validateRequisiteFields,
  type CreateRequisiteInput,
  type Requisite,
  type RequisiteOwnerType,
} from "../validation";

async function clearOtherDefaultsTx(
  tx: Transaction,
  input: {
    ownerType: RequisiteOwnerType;
    ownerId: string;
    currencyId: string;
    currentId: string;
  },
) {
  await tx
    .update(schema.requisites)
    .set({ isDefault: false })
    .where(
      and(
        eq(schema.requisites.ownerType, input.ownerType),
        input.ownerType === "organization"
          ? eq(schema.requisites.organizationId, input.ownerId)
          : eq(schema.requisites.counterpartyId, input.ownerId),
        eq(schema.requisites.currencyId, input.currencyId),
        isNull(schema.requisites.archivedAt),
        ne(schema.requisites.id, input.currentId),
      ),
    );

  await tx
    .update(schema.requisites)
    .set({ isDefault: true })
    .where(eq(schema.requisites.id, input.currentId));
}

async function assertOwnerExistsTx(
  tx: Transaction,
  input: { ownerType: RequisiteOwnerType; ownerId: string },
) {
  if (input.ownerType === "organization") {
    const [organization] = await tx
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, input.ownerId))
      .limit(1);
    if (!organization) {
      throw new OrganizationNotFoundError(input.ownerId);
    }
    return;
  }

  const [counterparty] = await tx
    .select({ id: schema.counterparties.id })
    .from(schema.counterparties)
    .where(eq(schema.counterparties.id, input.ownerId))
    .limit(1);
  if (!counterparty) {
    throw new CounterpartyNotFoundError(input.ownerId);
  }
}

async function assertProviderActiveTx(tx: Transaction, providerId: string) {
  const [provider] = await tx
    .select({ id: schema.requisiteProviders.id })
    .from(schema.requisiteProviders)
    .where(
      and(
        eq(schema.requisiteProviders.id, providerId),
        isNull(schema.requisiteProviders.archivedAt),
      ),
    )
    .limit(1);

  if (!provider) {
    throw new RequisiteProviderNotActiveError(providerId);
  }
}

export function createCreateRequisiteHandler(context: RequisitesServiceContext) {
  const { db, log } = context;

  return async function createRequisite(
    input: CreateRequisiteInput,
  ): Promise<Requisite> {
    const validated = CreateRequisiteInputSchema.parse(input);
    validateRequisiteFields({
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
      await assertOwnerExistsTx(tx, {
        ownerType: validated.ownerType,
        ownerId: validated.ownerId,
      });
      await assertProviderActiveTx(tx, validated.providerId);

      const existingRows = await tx
        .select({ id: schema.requisites.id })
        .from(schema.requisites)
        .where(
          and(
            eq(schema.requisites.ownerType, validated.ownerType),
            validated.ownerType === "organization"
              ? eq(schema.requisites.organizationId, validated.ownerId)
              : eq(schema.requisites.counterpartyId, validated.ownerId),
            eq(schema.requisites.currencyId, validated.currencyId),
            isNull(schema.requisites.archivedAt),
          ),
        );

      const shouldBeDefault =
        validated.isDefault === true || existingRows.length === 0;

      const [created] = await tx
        .insert(schema.requisites)
        .values({
          ownerType: validated.ownerType,
          organizationId:
            validated.ownerType === "organization" ? validated.ownerId : null,
          counterpartyId:
            validated.ownerType === "counterparty" ? validated.ownerId : null,
          providerId: validated.providerId,
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
        throw new RequisiteNotFoundError("create");
      }

      if (shouldBeDefault) {
        await clearOtherDefaultsTx(tx, {
          ownerType: validated.ownerType,
          ownerId: validated.ownerId,
          currencyId: validated.currencyId,
          currentId: created.id,
        });
      }

      if (validated.ownerType === "organization") {
        await ensureRequisiteAccountingBindingTx(tx, { requisiteId: created.id });
      }

      const [fresh] = await tx
        .select()
        .from(schema.requisites)
        .where(eq(schema.requisites.id, created.id))
        .limit(1);

      log.info("Requisite created", {
        id: created.id,
        ownerType: created.ownerType,
      });

      return toPublicRequisite(fresh!);
    });
  };
}
