"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

const DEFAULT_CREATE_ORGANIZATION_LABEL = "Новая организация";

type CreateDraftNameContextValue = {
  createName: string;
  createLabel: string;
  setCreateName: (name: string) => void;
  resetCreateName: () => void;
};

const CreateDraftNameContext = createContext<CreateDraftNameContextValue>({
  createName: "",
  createLabel: DEFAULT_CREATE_ORGANIZATION_LABEL,
  setCreateName: () => {},
  resetCreateName: () => {},
});

export function OrganizationCreateDraftNameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [createName, setCreateName] = useState("");
  const setCreateNameValue = useCallback((name: string) => {
    setCreateName(name);
  }, []);
  const resetCreateName = useCallback(() => {
    setCreateName("");
  }, []);

  const value = useMemo<CreateDraftNameContextValue>(() => {
    const trimmed = createName.trim();

    return {
      createName,
      createLabel:
        trimmed.length > 0 ? trimmed : DEFAULT_CREATE_ORGANIZATION_LABEL,
      setCreateName: setCreateNameValue,
      resetCreateName,
    };
  }, [createName, resetCreateName, setCreateNameValue]);

  return (
    <CreateDraftNameContext.Provider value={value}>
      {children}
    </CreateDraftNameContext.Provider>
  );
}

export function useOrganizationCreateDraftName() {
  return useContext(CreateDraftNameContext);
}
