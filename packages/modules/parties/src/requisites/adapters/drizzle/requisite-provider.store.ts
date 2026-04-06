import { and, eq, isNull } from "drizzle-orm";

import type { Queryable } from "@bedrock/platform/persistence";

import {
  requisiteProviderBranchIdentifiers,
  requisiteProviderBranches,
  requisiteProviderIdentifiers,
  requisiteProviders,
} from "./schema";
import { DrizzleRequisiteProviderReads } from "./requisite-provider.reads";
import type { RequisiteProviderStore } from "../../application/ports/requisite-provider.store";
import {
  normalizePaymentIdentifierScheme,
  normalizePaymentIdentifierValue,
} from "../../domain/identifier-schemes";

export class DrizzleRequisiteProviderStore implements RequisiteProviderStore {
  constructor(private readonly db: Queryable) {}

  findDetailById(id: string) {
    return new DrizzleRequisiteProviderReads(this.db).findById(id);
  }

  async findActiveById(id: string) {
    const [row] = await this.db
      .select()
      .from(requisiteProviders)
      .where(
        and(eq(requisiteProviders.id, id), isNull(requisiteProviders.archivedAt)),
      )
      .limit(1);

    return row ?? null;
  }

  async create(provider: {
    id: string;
    kind: "bank" | "exchange" | "blockchain" | "custodian";
    legalName: string;
    displayName: string;
    description: string | null;
    country: string | null;
    jurisdictionCode: string | null;
    website: string | null;
    archivedAt: Date | null;
  }) {
    const [created] = await this.db
      .insert(requisiteProviders)
      .values({
        ...provider,
      })
      .returning();

    return created!;
  }

  async update(provider: {
    id: string;
    kind: "bank" | "exchange" | "blockchain" | "custodian";
    legalName: string;
    displayName: string;
    description: string | null;
    country: string | null;
    jurisdictionCode: string | null;
    website: string | null;
    archivedAt: Date | null;
  }) {
    const [updated] = await this.db
      .update(requisiteProviders)
      .set({
        kind: provider.kind,
        legalName: provider.legalName,
        displayName: provider.displayName,
        description: provider.description,
        country: provider.country,
        jurisdictionCode: provider.jurisdictionCode,
        website: provider.website,
        archivedAt: provider.archivedAt,
      })
      .where(eq(requisiteProviders.id, provider.id))
      .returning();

    return updated ?? null;
  }

  async replaceIdentifiers(input: {
    providerId: string;
    items: {
      id?: string;
      scheme: string;
      value: string;
      isPrimary: boolean;
    }[];
  }): Promise<void> {
    await this.db
      .delete(requisiteProviderIdentifiers)
      .where(eq(requisiteProviderIdentifiers.providerId, input.providerId));

    if (input.items.length === 0) {
      return;
    }

    await this.db.insert(requisiteProviderIdentifiers).values(
      input.items.map((item) => ({
        id: item.id,
        providerId: input.providerId,
        scheme: normalizePaymentIdentifierScheme(item.scheme),
        value: item.value.trim(),
        normalizedValue: normalizePaymentIdentifierValue({
          owner: "provider",
          scheme: item.scheme,
          value: item.value,
        }),
        isPrimary: item.isPrimary,
      })),
    );
  }

  async replaceBranches(input: {
    providerId: string;
    items: {
      id?: string;
      code: string | null;
      name: string;
      country: string | null;
      jurisdictionCode: string | null;
      postalCode: string | null;
      city: string | null;
      line1: string | null;
      line2: string | null;
      rawAddress: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
      isPrimary: boolean;
      identifiers: {
        id?: string;
        scheme: string;
        value: string;
        isPrimary: boolean;
      }[];
    }[];
  }): Promise<void> {
    const existingBranches = await this.db
      .select({ id: requisiteProviderBranches.id })
      .from(requisiteProviderBranches)
      .where(eq(requisiteProviderBranches.providerId, input.providerId));
    const existingIds = new Set(existingBranches.map((branch) => branch.id));
    const keptIds = new Set<string>();

    for (const item of input.items) {
      const branchValues = {
        providerId: input.providerId,
        code: item.code,
        name: item.name,
        country: item.country,
        jurisdictionCode: item.jurisdictionCode,
        postalCode: item.postalCode,
        city: item.city,
        line1: item.line1,
        line2: item.line2,
        rawAddress: item.rawAddress,
        contactEmail: item.contactEmail,
        contactPhone: item.contactPhone,
        isPrimary: item.isPrimary,
        archivedAt: null,
      };

      const branchId =
        item.id && existingIds.has(item.id)
          ? (
              await this.db
                .update(requisiteProviderBranches)
                .set(branchValues)
                .where(
                  and(
                    eq(requisiteProviderBranches.id, item.id),
                    eq(requisiteProviderBranches.providerId, input.providerId),
                  ),
                )
                .returning({ id: requisiteProviderBranches.id })
            )[0]?.id
          : (
              await this.db
                .insert(requisiteProviderBranches)
                .values({
                  id: item.id,
                  ...branchValues,
                })
                .returning({ id: requisiteProviderBranches.id })
            )[0]?.id;

      if (!branchId) {
        continue;
      }

      keptIds.add(branchId);

      await this.db
        .delete(requisiteProviderBranchIdentifiers)
        .where(eq(requisiteProviderBranchIdentifiers.branchId, branchId));

      if (item.identifiers.length > 0) {
        await this.db.insert(requisiteProviderBranchIdentifiers).values(
          item.identifiers.map((identifier) => ({
            id: identifier.id,
            branchId,
            scheme: normalizePaymentIdentifierScheme(identifier.scheme),
            value: identifier.value.trim(),
            normalizedValue: normalizePaymentIdentifierValue({
              owner: "provider_branch",
              scheme: identifier.scheme,
              value: identifier.value,
            }),
            isPrimary: identifier.isPrimary,
          })),
        );
      }
    }

    for (const existingId of existingIds) {
      if (keptIds.has(existingId)) {
        continue;
      }

      await this.db
        .delete(requisiteProviderBranches)
        .where(eq(requisiteProviderBranches.id, existingId));
    }
  }

  async archive(id: string, archivedAt: Date): Promise<boolean> {
    const [row] = await this.db
      .update(requisiteProviders)
      .set({
        archivedAt,
        updatedAt: archivedAt,
      })
      .where(eq(requisiteProviders.id, id))
      .returning({ id: requisiteProviders.id });

    return Boolean(row);
  }
}
