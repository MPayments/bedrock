import { eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";

import type { Database, Transaction } from "../client";
import { schema } from "../schema-registry";
import { seedCounterparties } from "./counterparties";
import { AGREEMENTS } from "./fixtures";
import { seedOrganizations } from "./organizations";
import { seedRequisites } from "./requisites";

type DbLike = Database | Transaction;

function stableUuid(input: string) {
  const hex = createHash("sha256").update(input).digest("hex").slice(0, 32);
  const chars = hex.split("");

  chars[12] = "4";
  chars[16] = ["8", "9", "a", "b"][Number.parseInt(chars[16] ?? "0", 16) % 4]!;

  return [
    chars.slice(0, 8).join(""),
    chars.slice(8, 12).join(""),
    chars.slice(12, 16).join(""),
    chars.slice(16, 20).join(""),
    chars.slice(20, 32).join(""),
  ].join("-");
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function deleteSeededAgreements(db: DbLike) {
  const customerIds = [...new Set(AGREEMENTS.map((agreement) => agreement.customerId))];

  if (customerIds.length === 0) {
    return;
  }

  await db
    .delete(schema.agreements)
    .where(inArray(schema.agreements.customerId, customerIds));
}

async function insertAgreement(db: DbLike, agreement: (typeof AGREEMENTS)[number]) {
  const agreementId = stableUuid(`agreement:${agreement.key}`);
  const versionId = stableUuid(`agreement-version:${agreement.key}:1`);
  const customerPartyId = stableUuid(`agreement-party:${agreement.key}:customer`);
  const organizationPartyId = stableUuid(
    `agreement-party:${agreement.key}:organization`,
  );

  await db.insert(schema.agreements).values({
    id: agreementId,
    customerId: agreement.customerId,
    organizationId: agreement.organizationId,
    organizationRequisiteId: agreement.organizationRequisiteId,
    isActive: agreement.isActive,
    currentVersionId: null,
  });

  await db.insert(schema.agreementVersions).values({
    id: versionId,
    agreementId,
    versionNumber: 1,
    contractNumber: agreement.contractNumber,
    contractDate: parseDateOnly(agreement.contractDate),
  });

  await db.insert(schema.agreementParties).values([
    {
      id: customerPartyId,
      agreementVersionId: versionId,
      partyRole: "customer",
      customerId: agreement.customerId,
      organizationId: null,
    },
    {
      id: organizationPartyId,
      agreementVersionId: versionId,
      partyRole: "organization",
      customerId: null,
      organizationId: agreement.organizationId,
    },
  ]);

  if (agreement.feeRules.length > 0) {
    await db.insert(schema.agreementFeeRules).values(
      agreement.feeRules.map((rule) => ({
        id: stableUuid(`agreement-fee-rule:${agreement.key}:${rule.kind}`),
        agreementVersionId: versionId,
        kind: rule.kind,
        unit: rule.unit,
        valueNumeric: rule.value,
        currencyId: null,
      })),
    );
  }

  await db
    .update(schema.agreements)
    .set({
      currentVersionId: versionId,
      updatedAt: new Date(),
    })
    .where(eq(schema.agreements.id, agreementId));
}

export async function seedAgreements(db: DbLike) {
  await seedCounterparties(db);
  await seedOrganizations(db);
  await seedRequisites(db);

  await deleteSeededAgreements(db);

  for (const agreement of AGREEMENTS) {
    await insertAgreement(db, agreement);
  }

  const activeCount = AGREEMENTS.filter((agreement) => agreement.isActive).length;
  const inactiveCount = AGREEMENTS.length - activeCount;

  console.log(
    `[seed:agreements] Seeded ${AGREEMENTS.length} agreements (${activeCount} active, ${inactiveCount} inactive)`,
  );
}
