"use client";

import { createContext, use, useCallback, useMemo, useState } from "react";

const DEFAULT_CREATE_ORGANIZATION_LABEL = "Новая организация";

type CreateDraftNameContextValue = {
  createName: string;
  createLabel: string;
  setCreateName: (name: string) => void;
  resetCreateName: () => void;
};

const CreateDraftNameContext = createContext<CreateDraftNameContextValue | null>(
  null,
);

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
    <CreateDraftNameContext value={value}>{children}</CreateDraftNameContext>
  );
}

export function useOrganizationCreateDraftName() {
  const context = use(CreateDraftNameContext);
  if (!context) {
    throw new Error(
      "useOrganizationCreateDraftName must be used inside OrganizationCreateDraftNameProvider",
    );
  }

  return context;
}
