"use client";

import { createContext, use, useCallback, useMemo, useState } from "react";

type ActiveEditDraft = {
  id: string | null;
  fallbackName: string;
  draftName: string;
};

export type DraftNameState = {
  createName: string;
  createLabel: string;
  activeEdit: ActiveEditDraft;
};

export type DraftNameActions = {
  setCreateName: (name: string) => void;
  resetCreateName: () => void;
  registerEdit: (id: string, name: string) => void;
  setEditName: (id: string, name: string) => void;
  clearEdit: (id: string) => void;
};

export type DraftNameMeta = {
  getEditLabel: (id: string, fallbackName?: string) => string;
};

export type DraftNameContextValue = {
  state: DraftNameState;
  actions: DraftNameActions;
  meta: DraftNameMeta;
};

type CreateDraftNameContextOptions = {
  defaultCreateLabel: string;
  defaultEditLabel: string;
  hookName: string;
  providerName: string;
};

export function createDraftNameContext({
  defaultCreateLabel,
  defaultEditLabel,
  hookName,
  providerName,
}: CreateDraftNameContextOptions) {
  const DraftNameContext = createContext<DraftNameContextValue | null>(null);

  function DraftNameProvider({ children }: { children: React.ReactNode }) {
    const [createName, setCreateName] = useState("");
    const [activeEdit, setActiveEdit] = useState<ActiveEditDraft>({
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

    const registerEdit = useCallback((id: string, name: string) => {
      setActiveEdit((current) => {
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
      setActiveEdit((current) => {
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

    const clearEdit = useCallback((id: string) => {
      setActiveEdit((current) => {
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
      (id: string, fallbackName = defaultEditLabel) => {
        if (activeEdit.id !== id) {
          const fallbackTrimmed = fallbackName.trim();
          return fallbackTrimmed.length > 0
            ? fallbackTrimmed
            : defaultEditLabel;
        }

        const draftTrimmed = activeEdit.draftName.trim();
        if (draftTrimmed.length > 0) {
          return draftTrimmed;
        }

        const contextFallbackTrimmed = activeEdit.fallbackName.trim();
        if (contextFallbackTrimmed.length > 0) {
          return contextFallbackTrimmed;
        }

        const fallbackTrimmed = fallbackName.trim();
        return fallbackTrimmed.length > 0 ? fallbackTrimmed : defaultEditLabel;
      },
      [activeEdit],
    );

    const state = useMemo<DraftNameState>(() => {
      const trimmed = createName.trim();

      return {
        createName,
        createLabel: trimmed.length > 0 ? trimmed : defaultCreateLabel,
        activeEdit,
      };
    }, [activeEdit, createName]);

    const actions = useMemo<DraftNameActions>(
      () => ({
        setCreateName: setCreateNameValue,
        resetCreateName,
        registerEdit,
        setEditName,
        clearEdit,
      }),
      [
        clearEdit,
        registerEdit,
        resetCreateName,
        setCreateNameValue,
        setEditName,
      ],
    );

    const meta = useMemo<DraftNameMeta>(
      () => ({
        getEditLabel,
      }),
      [getEditLabel],
    );

    const value = useMemo<DraftNameContextValue>(() => {
      return {
        state,
        actions,
        meta,
      };
    }, [actions, meta, state]);

    return <DraftNameContext value={value}>{children}</DraftNameContext>;
  }

  function useDraftNameContext() {
    const context = use(DraftNameContext);

    if (!context) {
      throw new Error(`${hookName} must be used inside ${providerName}`);
    }

    return context;
  }

  return {
    DraftNameProvider,
    useDraftNameContext,
  };
}
