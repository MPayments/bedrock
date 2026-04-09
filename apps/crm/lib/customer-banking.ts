import { z } from "zod";

import { normalizeToAlpha2 } from "@bedrock/shared/reference-data/countries";

import { apiClient } from "@/lib/api-client";
import { readJsonWithSchema } from "@/lib/api/response";

export type CustomerBankProviderSnapshot = {
  address?: string;
  country?: string;
  name?: string;
  routingCode?: string;
};

export type CustomerBankRequisiteSnapshot = {
  accountNo?: string;
  beneficiaryName?: string;
  corrAccount?: string;
  iban?: string;
};

export type CustomerBankingFormValues = {
  bankMode: "existing" | "manual";
  bankProviderId: string | null;
  bankProvider: CustomerBankProviderSnapshot;
  bankRequisite: CustomerBankRequisiteSnapshot;
};

export type CustomerBankProviderSearchResult = {
  address: string | null;
  bic: string | null;
  country: string | null;
  displayLabel: string;
  id: string;
  name: string;
  swift: string | null;
};

const RequisiteProviderListResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.uuid(),
      country: z.string().nullable(),
      displayName: z.string(),
      kind: z.enum(["bank", "blockchain", "exchange", "custodian"]),
      legalName: z.string(),
    }),
  ),
});

const RequisiteProviderDetailSchema = z.object({
  id: z.uuid(),
  country: z.string().nullable(),
  displayName: z.string(),
  legalName: z.string(),
  identifiers: z.array(
    z.object({
      scheme: z.string(),
      value: z.string(),
    }),
  ),
  branches: z.array(
    z.object({
      country: z.string().nullable(),
      line1: z.string().nullable(),
      line2: z.string().nullable(),
      city: z.string().nullable(),
      postalCode: z.string().nullable(),
      rawAddress: z.string().nullable(),
      isPrimary: z.boolean(),
      identifiers: z.array(
        z.object({
          scheme: z.string(),
          value: z.string(),
        }),
      ),
    }),
  ),
});

type FlatBankingSource = {
  account?: string | null;
  bankAddress?: string | null;
  bankCountry?: string | null;
  bankMode?: "existing" | "manual" | null;
  bankName?: string | null;
  bankProviderId?: string | null;
  beneficiaryName?: string | null;
  bic?: string | null;
  corrAccount?: string | null;
  iban?: string | null;
  swift?: string | null;
};

function normalizeNullableText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCountryCode(value: string | null | undefined) {
  const normalized = normalizeNullableText(value);
  if (!normalized) {
    return null;
  }

  return normalizeToAlpha2(normalized) ?? normalized.toUpperCase();
}

export function normalizeRoutingCode(input: {
  bic?: string | null;
  country?: string | null;
  routingCode?: string | null;
  swift?: string | null;
}) {
  const bic = normalizeNullableText(input.bic);
  const swift = normalizeNullableText(input.swift)?.toUpperCase() ?? null;
  const routingCode =
    normalizeNullableText(input.routingCode)?.toUpperCase() ?? null;
  const country = normalizeCountryCode(input.country);

  if (bic || swift) {
    return {
      bic,
      routingCode: bic ?? swift ?? "",
      swift,
    };
  }

  if (!routingCode) {
    return {
      bic: null,
      routingCode: "",
      swift: null,
    };
  }

  return country === "RU"
    ? {
        bic: routingCode,
        routingCode,
        swift: null,
      }
    : {
        bic: null,
        routingCode,
        swift: routingCode,
      };
}

export function createManualBankProvider(
  provider: CustomerBankProviderSearchResult,
): CustomerBankProviderSnapshot {
  const routing = normalizeRoutingCode({
    bic: provider.bic,
    country: provider.country,
    swift: provider.swift,
  });

  return {
    address: provider.address ?? "",
    country: normalizeCountryCode(provider.country) ?? "",
    name: provider.name,
    routingCode: routing.routingCode,
  };
}

export function getDefaultCustomerBankingValues(): CustomerBankingFormValues {
  return {
    bankMode: "existing",
    bankProvider: {
      address: "",
      country: "RU",
      name: "",
      routingCode: "",
    },
    bankProviderId: null,
    bankRequisite: {
      accountNo: "",
      beneficiaryName: "",
      corrAccount: "",
      iban: "",
    },
  };
}

export function mapFlatBankingToFormValues(
  input: FlatBankingSource,
): CustomerBankingFormValues {
  const base = getDefaultCustomerBankingValues();
  const country = normalizeCountryCode(input.bankCountry) ?? base.bankProvider.country;
  const routing = normalizeRoutingCode({
    bic: input.bic,
    country,
    swift: input.swift,
  });

  return {
    bankMode:
      input.bankMode ??
      (normalizeNullableText(input.bankProviderId) ? "existing" : "manual"),
    bankProvider: {
      address: normalizeNullableText(input.bankAddress) ?? "",
      country,
      name: normalizeNullableText(input.bankName) ?? "",
      routingCode: routing.routingCode,
    },
    bankProviderId: normalizeNullableText(input.bankProviderId),
    bankRequisite: {
      accountNo: normalizeNullableText(input.account) ?? "",
      beneficiaryName: normalizeNullableText(input.beneficiaryName) ?? "",
      corrAccount: normalizeNullableText(input.corrAccount) ?? "",
      iban: normalizeNullableText(input.iban) ?? "",
    },
  };
}

export function createCustomerBankingPayload(
  values: CustomerBankingFormValues,
) {
  const country = normalizeCountryCode(values.bankProvider.country);
  const routing = normalizeRoutingCode({
    country,
    routingCode: values.bankProvider.routingCode,
  });
  const bankProviderId =
    values.bankMode === "existing"
      ? normalizeNullableText(values.bankProviderId)
      : null;

  return {
    account: normalizeNullableText(values.bankRequisite.accountNo),
    bankAddress: normalizeNullableText(values.bankProvider.address),
    bankCountry: country,
    bankMode: values.bankMode,
    bankName: normalizeNullableText(values.bankProvider.name),
    bankProvider: {
      address: normalizeNullableText(values.bankProvider.address),
      country,
      name: normalizeNullableText(values.bankProvider.name),
      routingCode: normalizeNullableText(values.bankProvider.routingCode)?.toUpperCase() ?? null,
    },
    bankProviderId,
    bankRequisite: {
      accountNo: normalizeNullableText(values.bankRequisite.accountNo),
      beneficiaryName: normalizeNullableText(values.bankRequisite.beneficiaryName),
      corrAccount: normalizeNullableText(values.bankRequisite.corrAccount),
      iban: normalizeNullableText(values.bankRequisite.iban),
    },
    beneficiaryName: normalizeNullableText(values.bankRequisite.beneficiaryName),
    bic: routing.bic,
    corrAccount: normalizeNullableText(values.bankRequisite.corrAccount),
    iban: normalizeNullableText(values.bankRequisite.iban),
    swift: routing.swift,
  };
}

function findProviderIdentifier(
  provider: z.infer<typeof RequisiteProviderDetailSchema>,
  scheme: string,
) {
  const branchValue =
    provider.branches
      .flatMap((branch) => (branch.isPrimary ? branch.identifiers : []))
      .find((identifier) => identifier.scheme === scheme)?.value ?? null;

  if (branchValue) {
    return branchValue;
  }

  return (
    provider.identifiers.find((identifier) => identifier.scheme === scheme)
      ?.value ?? null
  );
}

function formatProviderAddress(
  provider: z.infer<typeof RequisiteProviderDetailSchema>,
) {
  const primaryBranch =
    provider.branches.find((branch) => branch.isPrimary) ?? provider.branches[0];
  if (!primaryBranch) {
    return null;
  }

  const fallback = [
    primaryBranch.line1,
    primaryBranch.line2,
    primaryBranch.city,
    primaryBranch.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return primaryBranch.rawAddress ?? (fallback || null);
}

export async function searchCustomerBankProviders(input: {
  query: string;
  signal?: AbortSignal;
}) {
  const trimmed = input.query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const response = await apiClient.v1.requisites.providers.$get(
    {
      query: {
        displayName: trimmed,
        kind: ["bank"],
        limit: 8,
        offset: 0,
        sortBy: "displayName",
        sortOrder: "asc",
      },
    },
    {
      init: { signal: input.signal },
    },
  );

  if (!response.ok) {
    throw new Error(`Ошибка поиска банка: ${response.status}`);
  }

  const payload = await readJsonWithSchema(
    response,
    RequisiteProviderListResponseSchema,
  );

  const details = await Promise.all(
    payload.data.map(async (provider) => {
      const detailResponse = await apiClient.v1.requisites.providers[":id"].$get(
        {
          param: { id: provider.id },
        },
        {
          init: { signal: input.signal },
        },
      );

      if (!detailResponse.ok) {
        throw new Error(`Ошибка загрузки банка: ${detailResponse.status}`);
      }

      return readJsonWithSchema(detailResponse, RequisiteProviderDetailSchema);
    }),
  );

  return details.map((provider) => {
    const bic = findProviderIdentifier(provider, "bic");
    const swift = findProviderIdentifier(provider, "swift");
    const name = provider.displayName || provider.legalName;

    return {
      address: formatProviderAddress(provider),
      bic,
      country: provider.country,
      displayLabel: [name, provider.country, bic ?? swift].filter(Boolean).join(" · "),
      id: provider.id,
      name,
      swift,
    };
  });
}
