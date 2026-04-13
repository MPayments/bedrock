import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";

import type { Database, Transaction } from "../client";
import { schema } from "../schema-registry";
import { ORGANIZATION_IDS, seedOrganizations } from "./organizations";
import { REQUISITE_IDS, seedRequisites } from "./requisites";

type SeedDb = Database | Transaction;

export const PAYMENT_DEAL_IDS = {
  AGREEMENT: "4b7bff28-0387-4b55-8e11-6b234f3b8201",
  AGREEMENT_VERSION: "0d29ffdb-2c0a-48b6-92b4-f0d7bb464d5d",
  AGREEMENT_CUSTOMER_PARTY: "ab8f8225-2e58-4636-a78a-e748d67c9e01",
  AGREEMENT_ORGANIZATION_PARTY: "24b73ef1-46e2-4139-9fe1-969b8cbfe7a6",
  COUNTERPARTY: "00000000-0000-4000-8000-000000000312",
  COUNTERPARTY_GROUP: "7f4fb03e-cf79-40d7-b65f-530ceba920a1",
  CUSTOMER: "00000000-0000-4000-8000-000000000211",
  FEE_RULE: "9f20aac6-07d1-4cf9-a49c-a6f4aeb0e6b5",
} as const;

const PAYMENT_DEAL_FIXTURE = {
  agreement: {
    contractDate: "2026-01-15",
    contractNumber: "WP-AFA-2026-001",
  },
  counterparty: {
    address:
      "Office 14, The Curve Building, Sheikh Zayed Road, Dubai, United Arab Emirates",
    country: "AE" as const,
    externalRef: "white-pride-acting-entity",
    fullName: "WHITE PRIDE LLC",
    groupCode: "customer:white-pride",
    identifiers: [
      { scheme: "trade_license", value: "WP-TRD-2026-001" },
      { scheme: "tax_id", value: "100523401600003" },
    ] as const,
    representative: {
      basisDocument: "Charter",
      fullName: "Aleksei Eremasov",
      role: "director" as const,
      title: "Director",
    },
    shortName: "WHITE PRIDE LLC",
  },
  customer: {
    externalRef: "white-pride",
    name: "White Pride",
  },
  feeRule: {
    kind: "agent_fee" as const,
    unit: "bps" as const,
    value: "100",
  },
  organization: {
    id: ORGANIZATION_IDS.ARABIAN_FUEL_ALLIANCE,
    requisiteId: REQUISITE_IDS.ARABIAN_FUEL_ALLIANCE_DIB_AED,
  },
} as const;

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

async function upsertCustomer(db: SeedDb) {
  await db
    .insert(schema.customers)
    .values({
      externalRef: PAYMENT_DEAL_FIXTURE.customer.externalRef,
      id: PAYMENT_DEAL_IDS.CUSTOMER,
      name: PAYMENT_DEAL_FIXTURE.customer.name,
    })
    .onConflictDoUpdate({
      target: schema.customers.id,
      set: {
        externalRef: PAYMENT_DEAL_FIXTURE.customer.externalRef,
        name: PAYMENT_DEAL_FIXTURE.customer.name,
      },
    });
}

async function upsertCounterparty(db: SeedDb) {
  await db
    .insert(schema.counterparties)
    .values({
      country: PAYMENT_DEAL_FIXTURE.counterparty.country,
      customerId: PAYMENT_DEAL_IDS.CUSTOMER,
      description: "Acting legal entity used for the local payment deal CRM flow.",
      externalRef: PAYMENT_DEAL_FIXTURE.counterparty.externalRef,
      fullName: PAYMENT_DEAL_FIXTURE.counterparty.fullName,
      id: PAYMENT_DEAL_IDS.COUNTERPARTY,
      kind: "legal_entity",
      relationshipKind: "customer_owned",
      shortName: PAYMENT_DEAL_FIXTURE.counterparty.shortName,
    })
    .onConflictDoUpdate({
      target: schema.counterparties.id,
      set: {
        country: PAYMENT_DEAL_FIXTURE.counterparty.country,
        customerId: PAYMENT_DEAL_IDS.CUSTOMER,
        description: "Acting legal entity used for the local payment deal CRM flow.",
        externalRef: PAYMENT_DEAL_FIXTURE.counterparty.externalRef,
        fullName: PAYMENT_DEAL_FIXTURE.counterparty.fullName,
        kind: "legal_entity",
        relationshipKind: "customer_owned",
        shortName: PAYMENT_DEAL_FIXTURE.counterparty.shortName,
      },
    });

  const [profile] = await db
    .insert(schema.partyProfiles)
    .values({
      businessActivityCode: null,
      businessActivityText:
        "Cross-border payment customer for payment deal smoke tests.",
      businessActivityTextI18n: null,
      counterpartyId: PAYMENT_DEAL_IDS.COUNTERPARTY,
      countryCode: PAYMENT_DEAL_FIXTURE.counterparty.country,
      fullName: PAYMENT_DEAL_FIXTURE.counterparty.fullName,
      fullNameI18n: null,
      legalFormCode: "llc",
      legalFormLabel: "LLC",
      legalFormLabelI18n: null,
      organizationId: null,
      shortName: PAYMENT_DEAL_FIXTURE.counterparty.shortName,
      shortNameI18n: null,
    })
    .onConflictDoUpdate({
      target: schema.partyProfiles.counterpartyId,
      set: {
        businessActivityCode: null,
        businessActivityText:
          "Cross-border payment customer for payment deal smoke tests.",
        businessActivityTextI18n: null,
        countryCode: PAYMENT_DEAL_FIXTURE.counterparty.country,
        fullName: PAYMENT_DEAL_FIXTURE.counterparty.fullName,
        fullNameI18n: null,
        legalFormCode: "llc",
        legalFormLabel: "LLC",
        legalFormLabelI18n: null,
        shortName: PAYMENT_DEAL_FIXTURE.counterparty.shortName,
        shortNameI18n: null,
        updatedAt: new Date(),
      },
    })
    .returning({ id: schema.partyProfiles.id });

  const profileId = profile?.id;
  if (!profileId) {
    throw new Error(
      "[seed:deal-payment] Failed to upsert White Pride party profile.",
    );
  }

  await db
    .delete(schema.partyIdentifiers)
    .where(eq(schema.partyIdentifiers.partyProfileId, profileId));
  await db
    .delete(schema.partyAddresses)
    .where(eq(schema.partyAddresses.partyProfileId, profileId));
  await db
    .delete(schema.partyContacts)
    .where(eq(schema.partyContacts.partyProfileId, profileId));
  await db
    .delete(schema.partyRepresentatives)
    .where(eq(schema.partyRepresentatives.partyProfileId, profileId));
  await db
    .delete(schema.partyLicenses)
    .where(eq(schema.partyLicenses.partyProfileId, profileId));

  await db.insert(schema.partyIdentifiers).values(
    PAYMENT_DEAL_FIXTURE.counterparty.identifiers.map((identifier) => ({
      normalizedValue: identifier.value,
      partyProfileId: profileId,
      scheme: identifier.scheme,
      value: identifier.value,
    })),
  );

  await db.insert(schema.partyAddresses).values({
    addressDetails: null,
    addressDetailsI18n: null,
    city: "Dubai",
    cityI18n: null,
    countryCode: PAYMENT_DEAL_FIXTURE.counterparty.country,
    fullAddress: PAYMENT_DEAL_FIXTURE.counterparty.address,
    fullAddressI18n: null,
    partyProfileId: profileId,
    postalCode: null,
    streetAddress: null,
    streetAddressI18n: null,
  });

  await db.insert(schema.partyContacts).values({
    isPrimary: true,
    partyProfileId: profileId,
    type: "email",
    value: "ops@white-pride.example",
  });

  await db.insert(schema.partyRepresentatives).values({
    basisDocument: PAYMENT_DEAL_FIXTURE.counterparty.representative.basisDocument,
    basisDocumentI18n: null,
    fullName: PAYMENT_DEAL_FIXTURE.counterparty.representative.fullName,
    fullNameI18n: null,
    isPrimary: true,
    partyProfileId: profileId,
    role: PAYMENT_DEAL_FIXTURE.counterparty.representative.role,
    title: PAYMENT_DEAL_FIXTURE.counterparty.representative.title,
    titleI18n: null,
  });

  await db
    .insert(schema.counterpartyGroups)
    .values({
      code: PAYMENT_DEAL_FIXTURE.counterparty.groupCode,
      customerId: PAYMENT_DEAL_IDS.CUSTOMER,
      description: "Auto-created payment deal group",
      id: PAYMENT_DEAL_IDS.COUNTERPARTY_GROUP,
      isSystem: false,
      name: PAYMENT_DEAL_FIXTURE.customer.name,
      parentId: null,
    })
    .onConflictDoUpdate({
      target: schema.counterpartyGroups.code,
      set: {
        customerId: PAYMENT_DEAL_IDS.CUSTOMER,
        description: "Auto-created payment deal group",
        name: PAYMENT_DEAL_FIXTURE.customer.name,
        parentId: null,
      },
    });

  const [group] = await db
    .select({ id: schema.counterpartyGroups.id })
    .from(schema.counterpartyGroups)
    .where(
      eq(schema.counterpartyGroups.code, PAYMENT_DEAL_FIXTURE.counterparty.groupCode),
    )
    .limit(1);

  if (!group) {
    throw new Error("[seed:deal-payment] Failed to load the White Pride group.");
  }

  await db
    .insert(schema.counterpartyGroupMemberships)
    .values({
      counterpartyId: PAYMENT_DEAL_IDS.COUNTERPARTY,
      groupId: group.id,
    })
    .onConflictDoNothing();
}

async function upsertAgreement(db: SeedDb) {
  await db
    .insert(schema.agreements)
    .values({
      currentVersionId: null,
      customerId: PAYMENT_DEAL_IDS.CUSTOMER,
      id: PAYMENT_DEAL_IDS.AGREEMENT,
      isActive: true,
      organizationId: PAYMENT_DEAL_FIXTURE.organization.id,
      organizationRequisiteId: PAYMENT_DEAL_FIXTURE.organization.requisiteId,
    })
    .onConflictDoUpdate({
      target: schema.agreements.id,
      set: {
        customerId: PAYMENT_DEAL_IDS.CUSTOMER,
        isActive: true,
        organizationId: PAYMENT_DEAL_FIXTURE.organization.id,
        organizationRequisiteId: PAYMENT_DEAL_FIXTURE.organization.requisiteId,
      },
    });

  await db
    .insert(schema.agreementVersions)
    .values({
      agreementId: PAYMENT_DEAL_IDS.AGREEMENT,
      contractDate: new Date(
        `${PAYMENT_DEAL_FIXTURE.agreement.contractDate}T00:00:00.000Z`,
      ),
      contractNumber: PAYMENT_DEAL_FIXTURE.agreement.contractNumber,
      id: PAYMENT_DEAL_IDS.AGREEMENT_VERSION,
      versionNumber: 1,
    })
    .onConflictDoUpdate({
      target: schema.agreementVersions.id,
      set: {
        contractDate: new Date(
          `${PAYMENT_DEAL_FIXTURE.agreement.contractDate}T00:00:00.000Z`,
        ),
        contractNumber: PAYMENT_DEAL_FIXTURE.agreement.contractNumber,
        versionNumber: 1,
      },
    });

  await db
    .insert(schema.agreementParties)
    .values([
      {
        agreementVersionId: PAYMENT_DEAL_IDS.AGREEMENT_VERSION,
        customerId: PAYMENT_DEAL_IDS.CUSTOMER,
        id: PAYMENT_DEAL_IDS.AGREEMENT_CUSTOMER_PARTY,
        organizationId: null,
        partyRole: "customer",
      },
      {
        agreementVersionId: PAYMENT_DEAL_IDS.AGREEMENT_VERSION,
        customerId: null,
        id: PAYMENT_DEAL_IDS.AGREEMENT_ORGANIZATION_PARTY,
        organizationId: PAYMENT_DEAL_FIXTURE.organization.id,
        partyRole: "organization",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(schema.agreementFeeRules)
    .values({
      agreementVersionId: PAYMENT_DEAL_IDS.AGREEMENT_VERSION,
      currencyId: null,
      id: PAYMENT_DEAL_IDS.FEE_RULE,
      kind: PAYMENT_DEAL_FIXTURE.feeRule.kind,
      unit: PAYMENT_DEAL_FIXTURE.feeRule.unit,
      valueNumeric: PAYMENT_DEAL_FIXTURE.feeRule.value,
    })
    .onConflictDoUpdate({
      target: schema.agreementFeeRules.id,
      set: {
        currencyId: null,
        kind: PAYMENT_DEAL_FIXTURE.feeRule.kind,
        unit: PAYMENT_DEAL_FIXTURE.feeRule.unit,
        valueNumeric: PAYMENT_DEAL_FIXTURE.feeRule.value,
      },
    });

  await db
    .update(schema.agreements)
    .set({
      currentVersionId: PAYMENT_DEAL_IDS.AGREEMENT_VERSION,
      updatedAt: new Date(),
    })
    .where(eq(schema.agreements.id, PAYMENT_DEAL_IDS.AGREEMENT));
}

export async function seedDealPayment(db: SeedDb) {
  await seedOrganizations(db);
  await seedRequisites(db);
  await upsertCustomer(db);
  await upsertCounterparty(db);
  await upsertAgreement(db);

  console.log(
    `[seed:deal-payment] Ready: customer=${PAYMENT_DEAL_FIXTURE.customer.name}, counterparty=${PAYMENT_DEAL_FIXTURE.counterparty.shortName}, agreement=${PAYMENT_DEAL_FIXTURE.agreement.contractNumber}, operator=operator@bedrock.com`,
  );
  console.log(
    `[seed:deal-payment] Stable ids: customer=${PAYMENT_DEAL_IDS.CUSTOMER}, counterparty=${PAYMENT_DEAL_IDS.COUNTERPARTY}, agreement=${PAYMENT_DEAL_IDS.AGREEMENT}, workflowTag=${stableUuid("deal-payment")}`,
  );
}
