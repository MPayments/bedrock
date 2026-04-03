import type { CurrenciesService } from "@bedrock/currencies";
import type { PartiesModule } from "@bedrock/parties";
import type { Logger } from "@bedrock/platform/observability/logger";

type RequisitesApi = PartiesModule["requisites"];

export interface LegalEntityBankingInput {
  bankProviderId?: string | null;
  bankProvider?: {
    address?: string | null;
    country?: string | null;
    name?: string | null;
    routingCode?: string | null;
  } | null;
  bankRequisite?: {
    accountNo?: string | null;
    beneficiaryName?: string | null;
    corrAccount?: string | null;
    iban?: string | null;
  } | null;
  country?: string | null;
  orgName: string;
}

export interface CustomerBankingServiceDeps {
  currencies: Pick<CurrenciesService, "findByCode">;
  logger: Logger;
  requisites: RequisitesApi;
}

export interface CustomerBankingService {
  searchBankProviders(input: {
    limit?: number;
    query: string;
  }): Promise<BankProviderSearchResult[]>;
  upsertCounterpartyBankRequisite(input: {
    counterpartyId: string;
    values: LegalEntityBankingInput;
  }): Promise<{
    provider: Awaited<ReturnType<RequisitesApi["queries"]["findProviderById"]>> | null;
    requisite: Awaited<ReturnType<RequisitesApi["queries"]["findById"]>> | null;
  }>;
}

export interface BankProviderSearchResult {
  address: string | null;
  bic: string | null;
  country: string | null;
  displayLabel: string;
  id: string;
  name: string;
  swift: string | null;
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCountryCode(value: string | null | undefined): string | null {
  const normalized = normalizeNullableText(value)?.toUpperCase() ?? null;
  return normalized && normalized.length === 2 ? normalized : null;
}

function hasBankSignal(input: LegalEntityBankingInput) {
  return Boolean(
    normalizeNullableText(input.bankProvider?.name) ||
      normalizeNullableText(input.bankProvider?.address) ||
      normalizeNullableText(input.bankProvider?.routingCode) ||
      normalizeNullableText(input.bankRequisite?.accountNo) ||
      normalizeNullableText(input.bankRequisite?.corrAccount) ||
      normalizeNullableText(input.bankRequisite?.iban) ||
      normalizeNullableText(input.bankProviderId),
  );
}

function resolveRoutingFields(input: {
  bic?: string | null;
  country?: string | null;
  routingCode?: string | null;
  swift?: string | null;
}) {
  const country = normalizeCountryCode(input.country);
  const normalizedBic = normalizeNullableText(input.bic);
  const normalizedSwift =
    normalizeNullableText(input.swift)?.toUpperCase() ?? null;
  const routingCode =
    normalizeNullableText(input.routingCode)?.toUpperCase() ?? null;

  if (normalizedBic || normalizedSwift) {
    return {
      bic: normalizedBic,
      swift: normalizedSwift,
    };
  }

  if (!routingCode) {
    return {
      bic: null,
      swift: null,
    };
  }

  return country === "RU"
    ? { bic: routingCode, swift: null }
    : { bic: null, swift: routingCode };
}

function buildProviderLabel(input: {
  bic: string | null;
  country: string | null;
  name: string;
  swift: string | null;
}) {
  const details = [
    input.country,
    input.country === "RU" ? input.bic : input.swift,
  ].filter(Boolean);

  return details.length > 0
    ? `${input.name} (${details.join(", ")})`
    : input.name;
}

function isBankRequisitePayloadComplete(input: {
  accountNo: string | null;
  beneficiaryName: string | null;
}) {
  return Boolean(input.beneficiaryName && input.accountNo);
}

async function listCounterpartyBankRequisites(
  requisites: RequisitesApi,
  counterpartyIds: string[],
) {
  const rows = await Promise.all(
    counterpartyIds.map(async (counterpartyId) => {
      const result = await requisites.queries.list({
        kind: ["bank"],
        limit: 50,
        offset: 0,
        ownerId: counterpartyId,
        ownerType: "counterparty",
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      const preferred =
        result.data.find((item) => item.isDefault && item.archivedAt === null) ??
        result.data.find((item) => item.archivedAt === null) ??
        null;

      return [counterpartyId, preferred] as const;
    }),
  );

  return new Map(rows);
}

export function createCustomerBankingService(
  deps: CustomerBankingServiceDeps,
): CustomerBankingService {
  async function searchBankProviders(input: {
    limit?: number;
    query: string;
  }): Promise<BankProviderSearchResult[]> {
    const query = normalizeNullableText(input.query);
    if (!query) {
      return [];
    }

    const limit = Math.min(Math.max(input.limit ?? 8, 1), 20);
    const exactBic = query.replace(/\s+/g, "");
    const upperQuery = query.toUpperCase();

    const [byName, byBic, bySwift] = await Promise.all([
      deps.requisites.queries.listProviders({
        kind: ["bank"],
        limit,
        name: query,
        offset: 0,
        sortBy: "name",
        sortOrder: "asc",
      }),
      deps.requisites.queries.listProviders({
        bic: [exactBic],
        kind: ["bank"],
        limit,
        offset: 0,
        sortBy: "name",
        sortOrder: "asc",
      }),
      deps.requisites.queries.listProviders({
        kind: ["bank"],
        limit,
        offset: 0,
        sortBy: "name",
        sortOrder: "asc",
        swift: [upperQuery],
      }),
    ]);

    const merged = new Map<string, BankProviderSearchResult>();
    for (const provider of [...byName.data, ...byBic.data, ...bySwift.data]) {
      if (merged.has(provider.id)) {
        continue;
      }

      merged.set(provider.id, {
        address: provider.address,
        bic: provider.bic,
        country: provider.country,
        displayLabel: buildProviderLabel({
          bic: provider.bic,
          country: provider.country,
          name: provider.name,
          swift: provider.swift,
        }),
        id: provider.id,
        name: provider.name,
        swift: provider.swift,
      });
    }

    return Array.from(merged.values()).slice(0, limit);
  }

  async function resolveBankProvider(
    input: LegalEntityBankingInput,
    options?: { allowCreate?: boolean },
  ) {
    const selectedProviderId = normalizeNullableText(input.bankProviderId);
    if (selectedProviderId) {
      return deps.requisites.queries.findProviderById(selectedProviderId);
    }

    const providerName =
      normalizeNullableText(input.bankProvider?.name) ??
      normalizeNullableText(input.orgName) ??
      "Imported bank";
    const country = normalizeCountryCode(
      input.bankProvider?.country ?? input.country,
    );
    const { bic, swift } = resolveRoutingFields({
      country,
      routingCode: input.bankProvider?.routingCode,
    });

    const existing = await deps.requisites.queries.listProviders({
      bic: bic ? [bic] : undefined,
      country: country ? [country] : undefined,
      kind: ["bank"],
      limit: 50,
      name: providerName,
      offset: 0,
      sortBy: "createdAt",
      sortOrder: "desc",
      swift: swift ? [swift] : undefined,
    });
    const matched =
      existing.data.find(
        (provider) =>
          provider.name === providerName &&
          (country ? provider.country === country : true) &&
          (bic ? provider.bic === bic : true) &&
          (swift ? provider.swift === swift : true),
      ) ?? null;
    if (matched) {
      return matched;
    }

    if (!options?.allowCreate || !country || (!bic && !swift)) {
      return null;
    }

    return deps.requisites.commands.createProvider({
      address: normalizeNullableText(input.bankProvider?.address),
      bic,
      contact: null,
      country,
      description: "Created manually via portal onboarding",
      kind: "bank",
      name: providerName,
      swift,
    });
  }

  async function upsertCounterpartyBankRequisite(input: {
    counterpartyId: string;
    values: LegalEntityBankingInput;
  }) {
    const existingMap = await listCounterpartyBankRequisites(deps.requisites, [
      input.counterpartyId,
    ]);
    const existing = existingMap.get(input.counterpartyId) ?? null;

    if (!hasBankSignal(input.values) && !existing) {
      return { provider: null, requisite: null };
    }

    let provider = await resolveBankProvider(input.values);
    const beneficiaryName =
      normalizeNullableText(input.values.bankRequisite?.beneficiaryName) ??
      normalizeNullableText(input.values.orgName);
    const accountNo = normalizeNullableText(input.values.bankRequisite?.accountNo);

    if (
      !isBankRequisitePayloadComplete({
        accountNo,
        beneficiaryName,
      })
    ) {
      if (!provider && normalizeNullableText(input.values.bankProviderId)) {
        provider = await resolveBankProvider(input.values, {
          allowCreate: false,
        });
      }
      return { provider, requisite: existing };
    }

    if (!provider) {
      provider = await resolveBankProvider(input.values, {
        allowCreate: true,
      });
    }

    if (!provider) {
      return { provider: null, requisite: existing };
    }

    const resolvedProvider = provider;
    const currencyCode = resolvedProvider.country === "RU" ? "RUB" : "USD";
    const currency = await deps.currencies.findByCode(currencyCode);
    const bankValues = {
      accountNo,
      corrAccount: normalizeNullableText(input.values.bankRequisite?.corrAccount),
      isDefault: true,
      kind: "bank" as const,
      label:
        normalizeNullableText(input.values.bankProvider?.name) ??
        resolvedProvider.name ??
        normalizeNullableText(input.values.orgName) ??
        "Bank details",
      providerId: resolvedProvider.id,
    };

    const requisite = existing
      ? await deps.requisites.commands.update(existing.id, {
          ...bankValues,
          currencyId: currency.id,
        })
      : await deps.requisites.commands.create({
          ...bankValues,
          address: null,
          accountRef: null,
          assetCode: null,
          beneficiaryName,
          contact: null,
          currencyId: currency.id,
          description: null,
          iban: normalizeNullableText(input.values.bankRequisite?.iban),
          memoTag: null,
          network: null,
          notes: null,
          ownerId: input.counterpartyId,
          ownerType: "counterparty",
          subaccountRef: null,
        });

    deps.logger.info("Upserted counterparty bank requisite", {
      counterpartyId: input.counterpartyId,
      providerId: resolvedProvider.id,
      requisiteId: requisite.id,
    });

    return { provider: resolvedProvider, requisite };
  }

  return {
    searchBankProviders,
    upsertCounterpartyBankRequisite,
  };
}
