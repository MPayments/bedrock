"use client";

import { createContext, use, useCallback, useMemo, useState } from "react";

const DEFAULT_CREATE_CURRENCY_LABEL = "Новая валюта";
const DEFAULT_EDIT_CURRENCY_LABEL = "Валюта";

type ActiveEditCurrency = {
  id: string | null;
  fallbackName: string;
  draftName: string;
};

type CurrencyDraftNameContextValue = {
  createName: string;
  createLabel: string;
  setCreateName: (name: string) => void;
  resetCreateName: () => void;
  registerEditCurrency: (id: string, name: string) => void;
  setEditName: (id: string, name: string) => void;
  clearEditCurrency: (id: string) => void;
  getEditLabel: (id: string, fallbackName?: string) => string;
};

const CurrencyDraftNameContext =
  createContext<CurrencyDraftNameContextValue | null>(null);

export function CurrencyDraftNameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [createName, setCreateName] = useState("");
  const [activeEditCurrency, setActiveEditCurrency] =
    useState<ActiveEditCurrency>({
      id: null,
      fallbackName: "",
      draftName: "",
    });

  const setCreateNameValue = useCallback((name: string) => {
    setCreateName(name);
  }, []);

  const resetCreateName = useCallback(() => {
    setCreateName("");
  }, []);

  const registerEditCurrency = useCallback((id: string, name: string) => {
    setActiveEditCurrency((current) => {
      if (current.id === id) {
        if (current.fallbackName === name) {
          return current;
        }

        return {
          ...current,
          fallbackName: name,
        };
      }

      return {
        id,
        fallbackName: name,
        draftName: "",
      };
    });
  }, []);

  const setEditName = useCallback((id: string, name: string) => {
    setActiveEditCurrency((current) => {
      if (current.id !== id) {
        return {
          id,
          fallbackName: "",
          draftName: name,
        };
      }

      if (current.draftName === name) {
        return current;
      }

      return {
        ...current,
        draftName: name,
      };
    });
  }, []);

  const clearEditCurrency = useCallback((id: string) => {
    setActiveEditCurrency((current) => {
      if (current.id !== id) {
        return current;
      }

      return {
        id: null,
        fallbackName: "",
        draftName: "",
      };
    });
  }, []);

  const getEditLabel = useCallback(
    (id: string, fallbackName = DEFAULT_EDIT_CURRENCY_LABEL) => {
      if (activeEditCurrency.id !== id) {
        const fallbackTrimmed = fallbackName.trim();
        return fallbackTrimmed.length > 0
          ? fallbackTrimmed
          : DEFAULT_EDIT_CURRENCY_LABEL;
      }

      const draftTrimmed = activeEditCurrency.draftName.trim();
      if (draftTrimmed.length > 0) {
        return draftTrimmed;
      }

      const contextFallbackTrimmed = activeEditCurrency.fallbackName.trim();
      if (contextFallbackTrimmed.length > 0) {
        return contextFallbackTrimmed;
      }

      const fallbackTrimmed = fallbackName.trim();
      return fallbackTrimmed.length > 0
        ? fallbackTrimmed
        : DEFAULT_EDIT_CURRENCY_LABEL;
    },
    [activeEditCurrency],
  );

  const value = useMemo<CurrencyDraftNameContextValue>(() => {
    const trimmed = createName.trim();

    return {
      createName,
      createLabel:
        trimmed.length > 0 ? trimmed : DEFAULT_CREATE_CURRENCY_LABEL,
      setCreateName: setCreateNameValue,
      resetCreateName,
      registerEditCurrency,
      setEditName,
      clearEditCurrency,
      getEditLabel,
    };
  }, [
    clearEditCurrency,
    createName,
    getEditLabel,
    registerEditCurrency,
    resetCreateName,
    setCreateNameValue,
    setEditName,
  ]);

  return (
    <CurrencyDraftNameContext value={value}>
      {children}
    </CurrencyDraftNameContext>
  );
}

export function useCurrencyDraftName() {
  const context = use(CurrencyDraftNameContext);
  if (!context) {
    throw new Error(
      "useCurrencyDraftName must be used inside CurrencyDraftNameProvider",
    );
  }

  return context;
}
