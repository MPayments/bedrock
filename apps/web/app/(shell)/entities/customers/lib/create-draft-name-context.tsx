"use client";

import { createContext, use, useCallback, useMemo, useState } from "react";

const DEFAULT_CREATE_CUSTOMER_LABEL = "Новый клиент";
const DEFAULT_EDIT_CUSTOMER_LABEL = "Клиент";

type ActiveEditCustomer = {
  id: string | null;
  fallbackName: string;
  draftName: string;
};

type CustomerDraftNameContextValue = {
  createName: string;
  createLabel: string;
  setCreateName: (name: string) => void;
  resetCreateName: () => void;
  registerEditCustomer: (id: string, name: string) => void;
  setEditName: (id: string, name: string) => void;
  clearEditCustomer: (id: string) => void;
  getEditLabel: (id: string, fallbackName?: string) => string;
};

const CustomerDraftNameContext =
  createContext<CustomerDraftNameContextValue | null>(null);

export function CustomerDraftNameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [createName, setCreateName] = useState("");
  const [activeEditCustomer, setActiveEditCustomer] =
    useState<ActiveEditCustomer>({
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

  const registerEditCustomer = useCallback((id: string, name: string) => {
    setActiveEditCustomer((current) => {
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
    setActiveEditCustomer((current) => {
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

  const clearEditCustomer = useCallback((id: string) => {
    setActiveEditCustomer((current) => {
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
    (id: string, fallbackName = DEFAULT_EDIT_CUSTOMER_LABEL) => {
      if (activeEditCustomer.id !== id) {
        const fallbackTrimmed = fallbackName.trim();
        return fallbackTrimmed.length > 0
          ? fallbackTrimmed
          : DEFAULT_EDIT_CUSTOMER_LABEL;
      }

      const draftTrimmed = activeEditCustomer.draftName.trim();
      if (draftTrimmed.length > 0) {
        return draftTrimmed;
      }

      const contextFallbackTrimmed = activeEditCustomer.fallbackName.trim();
      if (contextFallbackTrimmed.length > 0) {
        return contextFallbackTrimmed;
      }

      const fallbackTrimmed = fallbackName.trim();
      return fallbackTrimmed.length > 0
        ? fallbackTrimmed
        : DEFAULT_EDIT_CUSTOMER_LABEL;
    },
    [activeEditCustomer],
  );

  const value = useMemo<CustomerDraftNameContextValue>(() => {
    const trimmed = createName.trim();

    return {
      createName,
      createLabel:
        trimmed.length > 0 ? trimmed : DEFAULT_CREATE_CUSTOMER_LABEL,
      setCreateName: setCreateNameValue,
      resetCreateName,
      registerEditCustomer,
      setEditName,
      clearEditCustomer,
      getEditLabel,
    };
  }, [
    clearEditCustomer,
    createName,
    getEditLabel,
    registerEditCustomer,
    resetCreateName,
    setCreateNameValue,
    setEditName,
  ]);

  return (
    <CustomerDraftNameContext value={value}>
      {children}
    </CustomerDraftNameContext>
  );
}

export function useCustomerDraftName() {
  const context = use(CustomerDraftNameContext);
  if (!context) {
    throw new Error(
      "useCustomerDraftName must be used inside CustomerDraftNameProvider",
    );
  }

  return context;
}
