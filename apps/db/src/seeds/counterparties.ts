import { and, eq, inArray } from "drizzle-orm";

import type { Database, Transaction } from "../client";
import { schema } from "../schema-registry";
import { COUNTERPARTIES, CUSTOMERS } from "./fixtures";

type SeedDb = Database | Transaction;

const CUSTOMER_GROUP_CODE_PREFIX = "customer:";

function customerGroupCode(customerId: string) {
  return `${CUSTOMER_GROUP_CODE_PREFIX}${customerId}`;
}

async function upsertCustomers(db: SeedDb) {
  for (const customer of CUSTOMERS) {
    await db
      .insert(schema.customers)
      .values({
        id: customer.id,
        name: customer.name,
        externalRef: customer.externalRef,
      })
      .onConflictDoUpdate({
        target: schema.customers.id,
        set: {
          name: customer.name,
          externalRef: customer.externalRef,
        },
      });
  }
}

async function upsertCounterparties(db: SeedDb) {
  for (const counterparty of COUNTERPARTIES) {
    await db
      .insert(schema.counterparties)
      .values({
        id: counterparty.id,
        externalRef: counterparty.externalRef,
        customerId: counterparty.customerId,
        relationshipKind: "customer_owned",
        shortName: counterparty.shortName,
        fullName: counterparty.fullName,
        description: null,
        kind: counterparty.kind,
        country: counterparty.country,
      })
      .onConflictDoUpdate({
        target: schema.counterparties.id,
        set: {
          externalRef: counterparty.externalRef,
          customerId: counterparty.customerId,
          relationshipKind: "customer_owned",
          shortName: counterparty.shortName,
          fullName: counterparty.fullName,
          description: null,
          kind: counterparty.kind,
          country: counterparty.country,
        },
      });

    await db
      .insert(schema.partyProfiles)
      .values({
        organizationId: null,
        counterpartyId: counterparty.id,
        fullName: counterparty.profile.fullName,
        shortName: counterparty.profile.shortName,
        fullNameI18n: counterparty.profile.fullNameI18n ?? null,
        shortNameI18n: counterparty.profile.shortNameI18n ?? null,
        legalFormCode: counterparty.profile.legalFormCode ?? null,
        legalFormLabel: counterparty.profile.legalFormLabel ?? null,
        legalFormLabelI18n: counterparty.profile.legalFormLabelI18n ?? null,
        countryCode: counterparty.profile.countryCode ?? counterparty.country ?? null,
        businessActivityCode: null,
        businessActivityText: counterparty.profile.businessActivityText ?? null,
        businessActivityTextI18n:
          counterparty.profile.businessActivityTextI18n ?? null,
      })
      .onConflictDoUpdate({
        target: schema.partyProfiles.counterpartyId,
        set: {
          fullName: counterparty.profile.fullName,
          shortName: counterparty.profile.shortName,
          fullNameI18n: counterparty.profile.fullNameI18n ?? null,
          shortNameI18n: counterparty.profile.shortNameI18n ?? null,
          legalFormCode: counterparty.profile.legalFormCode ?? null,
          legalFormLabel: counterparty.profile.legalFormLabel ?? null,
          legalFormLabelI18n: counterparty.profile.legalFormLabelI18n ?? null,
          countryCode:
            counterparty.profile.countryCode ?? counterparty.country ?? null,
          businessActivityText: counterparty.profile.businessActivityText ?? null,
          businessActivityTextI18n:
            counterparty.profile.businessActivityTextI18n ?? null,
          updatedAt: new Date(),
        },
      });

    const [profile] = await db
      .select({ id: schema.partyProfiles.id })
      .from(schema.partyProfiles)
      .where(eq(schema.partyProfiles.counterpartyId, counterparty.id));
    const profileId = profile?.id;
    if (!profileId) {
      throw new Error(
        `[seed:counterparties] Failed to upsert party profile for ${counterparty.id}`,
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

    if ((counterparty.profile.identifiers ?? []).length > 0) {
      await db.insert(schema.partyIdentifiers).values(
        counterparty.profile.identifiers!.map((identifier) => ({
          partyProfileId: profileId,
          scheme: identifier.scheme,
          value: identifier.value,
          normalizedValue: identifier.value,
        })),
      );
    }

    if (counterparty.profile.address) {
      await db.insert(schema.partyAddresses).values({
        partyProfileId: profileId,
        countryCode:
          counterparty.profile.address.countryCode
          ?? counterparty.profile.countryCode
          ?? counterparty.country
          ?? null,
        postalCode: counterparty.profile.address.postalCode ?? null,
        city: counterparty.profile.address.city ?? null,
        cityI18n: counterparty.profile.address.cityI18n ?? null,
        streetAddress: counterparty.profile.address.streetAddress ?? null,
        streetAddressI18n:
          counterparty.profile.address.streetAddressI18n ?? null,
        addressDetails: counterparty.profile.address.addressDetails ?? null,
        addressDetailsI18n:
          counterparty.profile.address.addressDetailsI18n ?? null,
        fullAddress: counterparty.profile.address.fullAddress ?? null,
        fullAddressI18n: counterparty.profile.address.fullAddressI18n ?? null,
      });
    }

    if ((counterparty.profile.contacts ?? []).length > 0) {
      await db.insert(schema.partyContacts).values(
        counterparty.profile.contacts!.map((contact) => ({
          partyProfileId: profileId,
          type: contact.type,
          value: contact.value,
          isPrimary: contact.isPrimary ?? false,
        })),
      );
    }

    if ((counterparty.profile.representatives ?? []).length > 0) {
      await db.insert(schema.partyRepresentatives).values(
        counterparty.profile.representatives!.map((representative) => ({
          partyProfileId: profileId,
          role: representative.role,
          fullName: representative.fullName,
          fullNameI18n: representative.fullNameI18n ?? null,
          title: representative.title ?? null,
          titleI18n: representative.titleI18n ?? null,
          basisDocument: representative.basisDocument ?? null,
          basisDocumentI18n: representative.basisDocumentI18n ?? null,
          isPrimary: representative.isPrimary ?? false,
        })),
      );
    }

    if ((counterparty.profile.licenses ?? []).length > 0) {
      await db.insert(schema.partyLicenses).values(
        counterparty.profile.licenses!.map((license) => ({
          partyProfileId: profileId,
          licenseType: license.type,
          licenseNumber: license.number,
          issuedBy: license.issuer ?? null,
          issuedByI18n: license.issuerI18n ?? null,
          issuedAt: license.issuedAt ? new Date(`${license.issuedAt}T00:00:00.000Z`) : null,
          expiresAt: license.expiresAt
            ? new Date(`${license.expiresAt}T00:00:00.000Z`)
            : null,
          activityText: license.activityText ?? null,
          activityTextI18n: license.activityTextI18n ?? null,
        })),
      );
    }
  }
}

async function ensureManagedCustomerGroups(
  db: SeedDb,
): Promise<Map<string, string>> {
  for (const customer of CUSTOMERS) {
    await db
      .insert(schema.counterpartyGroups)
      .values({
        code: customerGroupCode(customer.id),
        name: customer.name,
        description: "Auto-created customer group",
        parentId: null,
        customerId: customer.id,
        isSystem: false,
      })
      .onConflictDoUpdate({
        target: schema.counterpartyGroups.code,
        set: {
          name: customer.name,
          description: "Auto-created customer group",
          parentId: null,
          customerId: customer.id,
          isSystem: false,
        },
      });
  }

  const groups = await db
    .select({
      id: schema.counterpartyGroups.id,
      code: schema.counterpartyGroups.code,
    })
    .from(schema.counterpartyGroups)
    .where(
      inArray(
        schema.counterpartyGroups.code,
        CUSTOMERS.map((customer) => customerGroupCode(customer.id)),
      ),
    );

  const groupsByCustomerId = new Map(
    groups.map((group) => [
      group.code.slice(CUSTOMER_GROUP_CODE_PREFIX.length),
      group.id,
    ]),
  );

  for (const customer of CUSTOMERS) {
    if (!groupsByCustomerId.has(customer.id)) {
      throw new Error(
        `[seed:counterparties] Missing managed customer group for customer ${customer.id}`,
      );
    }
  }

  return groupsByCustomerId;
}

async function ensureManagedCustomerMemberships(
  db: SeedDb,
  groupsByCustomerId: Map<string, string>,
) {
  const managedGroupIds = [...groupsByCustomerId.values()];

  for (const counterparty of COUNTERPARTIES) {
    const managedGroupId = groupsByCustomerId.get(counterparty.customerId);
    if (!managedGroupId) {
      throw new Error(
        `[seed:counterparties] Missing managed group for counterparty ${counterparty.id}`,
      );
    }

    const staleManagedGroupIds = managedGroupIds.filter(
      (groupId) => groupId !== managedGroupId,
    );

    if (staleManagedGroupIds.length > 0) {
      await db
        .delete(schema.counterpartyGroupMemberships)
        .where(
          and(
            eq(
              schema.counterpartyGroupMemberships.counterpartyId,
              counterparty.id,
            ),
            inArray(
              schema.counterpartyGroupMemberships.groupId,
              staleManagedGroupIds,
            ),
          ),
        );
    }

    await db
      .insert(schema.counterpartyGroupMemberships)
      .values({
        counterpartyId: counterparty.id,
        groupId: managedGroupId,
      })
      .onConflictDoNothing();
  }
}

export async function seedCounterparties(db: SeedDb) {
  await upsertCustomers(db);
  await upsertCounterparties(db);
  const groupsByCustomerId = await ensureManagedCustomerGroups(db);
  await ensureManagedCustomerMemberships(db, groupsByCustomerId);

  console.log(
    `[seed:counterparties] Seeded ${COUNTERPARTIES.length} counterparties (${CUSTOMERS.length} customers and ${groupsByCustomerId.size} managed groups ensured)`,
  );
}
