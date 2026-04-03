"use client";

import { useCallback, useEffect, useState } from "react";

import { CurrencyOptionsResponseSchema } from "@bedrock/currencies/contracts";
import {
  BankRequisiteWorkspaceResponseSchema,
  RequisiteProviderOptionsResponseSchema,
} from "@bedrock/parties/contracts";

import { API_BASE_URL } from "@/lib/constants";

import type { CurrencyOption } from "@bedrock/currencies/contracts";
import type {
  CounterpartyBankRequisite,
} from "./counterparty-bank-requisites";
import type { RequisiteProviderOption } from "@bedrock/parties/contracts";

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

    const response = await fetch(
      `${API_BASE_URL}/requisites/bank-workspace?ownerType=counterparty&ownerId=${counterpartyId}`,
      {
        cache: "no-store",
        credentials: "include",
      },
    );

    if (!response.ok) {
      throw new Error(`Не удалось загрузить реквизиты: ${response.status}`);
    }

    const payload = BankRequisiteWorkspaceResponseSchema.parse(
      await response.json(),
    );
    setRequisites(payload.data);
    return payload.data;
  }, [counterpartyId]);

  const fetchOptions = useCallback(async () => {
    const [providersResponse, currenciesResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/requisites/providers/options`, {
        credentials: "include",
      }),
      fetch(`${API_BASE_URL}/currencies/options`, {
        credentials: "include",
      }),
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

    const providersPayload = RequisiteProviderOptionsResponseSchema.parse(
      await providersResponse.json(),
    );
    const currenciesPayload = CurrencyOptionsResponseSchema.parse(
      await currenciesResponse.json(),
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
          console.error("Failed to load counterparty bank requisites", fetchError);
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
