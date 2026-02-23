"use client";

import { createContext, use, useCallback, useMemo, useState } from "react";

const DEFAULT_CREATE_COUNTERPARTY_LABEL = "Новый контрагент";
const DEFAULT_EDIT_COUNTERPARTY_LABEL = "Контрагент";

type ActiveEditCounterparty = {
  id: string | null;
  fallbackName: string;
  draftName: string;
};

type CreateDraftNameContextValue = {
  createName: string;
  createLabel: string;
  setCreateName: (name: string) => void;
  resetCreateName: () => void;
  registerEditCounterparty: (id: string, name: string) => void;
  setEditName: (id: string, name: string) => void;
  clearEditCounterparty: (id: string) => void;
  getEditLabel: (id: string, fallbackName?: string) => string;
};

const CreateDraftNameContext = createContext<CreateDraftNameContextValue | null>(
  null,
);

export function CounterpartyCreateDraftNameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [createName, setCreateName] = useState("");
  const [activeEditCounterparty, setActiveEditCounterparty] =
    useState<ActiveEditCounterparty>({
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

  const registerEditCounterparty = useCallback((id: string, name: string) => {
    setActiveEditCounterparty((current) => {
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
    setActiveEditCounterparty((current) => {
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

  const clearEditCounterparty = useCallback((id: string) => {
    setActiveEditCounterparty((current) => {
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
    (id: string, fallbackName = DEFAULT_EDIT_COUNTERPARTY_LABEL) => {
      if (activeEditCounterparty.id !== id) {
        const fallbackTrimmed = fallbackName.trim();
        return fallbackTrimmed.length > 0
          ? fallbackTrimmed
          : DEFAULT_EDIT_COUNTERPARTY_LABEL;
      }

      const draftTrimmed = activeEditCounterparty.draftName.trim();
      if (draftTrimmed.length > 0) {
        return draftTrimmed;
      }

      const contextFallbackTrimmed = activeEditCounterparty.fallbackName.trim();
      if (contextFallbackTrimmed.length > 0) {
        return contextFallbackTrimmed;
      }

      const fallbackTrimmed = fallbackName.trim();
      return fallbackTrimmed.length > 0
        ? fallbackTrimmed
        : DEFAULT_EDIT_COUNTERPARTY_LABEL;
    },
    [activeEditCounterparty],
  );

  const value = useMemo<CreateDraftNameContextValue>(() => {
    const trimmed = createName.trim();

    return {
      createName,
      createLabel:
        trimmed.length > 0 ? trimmed : DEFAULT_CREATE_COUNTERPARTY_LABEL,
      setCreateName: setCreateNameValue,
      resetCreateName,
      registerEditCounterparty,
      setEditName,
      clearEditCounterparty,
      getEditLabel,
    };
  }, [
    clearEditCounterparty,
    createName,
    getEditLabel,
    registerEditCounterparty,
    resetCreateName,
    setCreateNameValue,
    setEditName,
  ]);

  return (
    <CreateDraftNameContext value={value}>{children}</CreateDraftNameContext>
  );
}

export function useCounterpartyCreateDraftName() {
  const context = use(CreateDraftNameContext);
  if (!context) {
    throw new Error(
      "useCounterpartyCreateDraftName must be used inside CounterpartyCreateDraftNameProvider",
    );
  }

  return context;
}
