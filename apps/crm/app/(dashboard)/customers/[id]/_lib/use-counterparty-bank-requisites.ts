"use client";

import { useCallback, useEffect, useState } from "react";

import { CurrencyOptionsResponseSchema } from "@bedrock/currencies/contracts";
import { RequisiteProviderOptionsResponseSchema } from "@bedrock/parties/contracts";

import { apiClient } from "@/lib/api-client";
import { readJsonWithSchema } from "@/lib/api/response";

import {
  CounterpartyBankRequisiteSchema,
  CounterpartyBankRequisitesListResponseSchema,
} from "./counterparty-bank-requisites";

import type { CurrencyOption } from "@bedrock/currencies/contracts";
import type { RequisiteProviderOption } from "@bedrock/parties/contracts";
import type { CounterpartyBankRequisite } from "./counterparty-bank-requisites";

type UseCounterpartyBankRequisitesResult = {
  currencyOptions: CurrencyOption[];
  error: string | null;
  loading: boolean;
  providerOptions: RequisiteProviderOption[];
  refresh: () => Promise<CounterpartyBankRequisite[]>;
  requisites: CounterpartyBankRequisite[];
};

export function useCounterpartyBankRequisites(
  counterpartyId: string | null,
): UseCounterpartyBankRequisitesResult {
  const [requisites, setRequisites] = useState<CounterpartyBankRequisite[]>([]);
  const [providerOptions, setProviderOptions] = useState<
    RequisiteProviderOption[]
  >([]);
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!counterpartyId) {
      setRequisites([]);
      return [];
    }

    const response = await apiClient.v1.counterparties[":id"].requisites.$get({
      param: { id: counterpartyId },
      query: {
        limit: 100,
        offset: 0,
      },
    });

    if (!response.ok) {
      throw new Error(`Не удалось загрузить реквизиты: ${response.status}`);
    }

    const payload = await readJsonWithSchema(
      response,
      CounterpartyBankRequisitesListResponseSchema,
    );
    const bankItems = payload.data.filter((item) => item.kind === "bank");
    const details = await Promise.all(
      bankItems.map(async (item) => {
        const detailResponse = await apiClient.v1.requisites[":id"].$get({
          param: { id: item.id },
        });

        if (!detailResponse.ok) {
          throw new Error(
            `Не удалось загрузить реквизит ${item.label}: ${detailResponse.status}`,
          );
        }

        return readJsonWithSchema(detailResponse, CounterpartyBankRequisiteSchema);
      }),
    );

    setRequisites(details);
    return details;
  }, [counterpartyId]);

  const fetchOptions = useCallback(async () => {
    const [providersResponse, currenciesResponse] = await Promise.all([
      apiClient.v1.requisites.providers.options.$get({}),
      apiClient.v1.currencies.options.$get({}),
    ]);

    if (!providersResponse.ok) {
      throw new Error(
        `Не удалось загрузить провайдеров реквизитов: ${providersResponse.status}`,
      );
    }

    if (!currenciesResponse.ok) {
      throw new Error(
        `Не удалось загрузить валюты: ${currenciesResponse.status}`,
      );
    }

    const providersPayload = await readJsonWithSchema(
      providersResponse,
      RequisiteProviderOptionsResponseSchema,
    );
    const currenciesPayload = await readJsonWithSchema(
      currenciesResponse,
      CurrencyOptionsResponseSchema,
    );

    setProviderOptions(
      providersPayload.data
        .filter((provider) => provider.kind === "bank")
        .sort((left, right) => left.label.localeCompare(right.label, "ru")),
    );
    setCurrencyOptions(
      [...currenciesPayload.data].sort((left, right) =>
        left.label.localeCompare(right.label, "ru"),
      ),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        if (providerOptions.length === 0 || currencyOptions.length === 0) {
          await Promise.all([refresh(), fetchOptions()]);
        } else {
          await refresh();
        }
      } catch (fetchError) {
        if (!cancelled) {
          console.error(
            "Failed to load counterparty bank requisites",
            fetchError,
          );
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Не удалось загрузить реквизиты",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [counterpartyId, currencyOptions.length, fetchOptions, providerOptions.length, refresh]);

  return {
    currencyOptions,
    error,
    loading,
    providerOptions,
    refresh,
    requisites,
  };
}
