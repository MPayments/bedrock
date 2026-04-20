"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";

import {
  buildBreadcrumbOverrideLookup,
  buildCrmBreadcrumbs,
  normalizeBreadcrumbOverrides,
  removeBreadcrumbOverrides,
  type BreadcrumbOverride,
  type BreadcrumbOverrideState,
  type CrmBreadcrumbItem,
  upsertBreadcrumbOverrides,
} from "./crm-breadcrumbs";

type BreadcrumbRegistry = {
  register: (registrationId: string, overrides: BreadcrumbOverride[]) => void;
  unregister: (registrationId: string) => void;
};

const CrmBreadcrumbItemsContext = createContext<CrmBreadcrumbItem[]>([]);
const CrmBreadcrumbRegistryContext = createContext<BreadcrumbRegistry | null>(
  null,
);

export function CrmBreadcrumbsProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const [registrations, setRegistrations] = useState<BreadcrumbOverrideState>(
    {},
  );

  const register = useCallback(
    (registrationId: string, overrides: BreadcrumbOverride[]) => {
      setRegistrations((currentState) =>
        upsertBreadcrumbOverrides(currentState, registrationId, overrides),
      );
    },
    [],
  );

  const unregister = useCallback((registrationId: string) => {
    setRegistrations((currentState) =>
      removeBreadcrumbOverrides(currentState, registrationId),
    );
  }, []);

  const overrideLookup = useMemo(
    () => buildBreadcrumbOverrideLookup(registrations),
    [registrations],
  );
  const items = useMemo(
    () => buildCrmBreadcrumbs(pathname ?? "/", overrideLookup),
    [overrideLookup, pathname],
  );
  const registry = useMemo(
    () => ({ register, unregister }),
    [register, unregister],
  );

  return (
    <CrmBreadcrumbRegistryContext.Provider value={registry}>
      <CrmBreadcrumbItemsContext.Provider value={items}>
        {children}
      </CrmBreadcrumbItemsContext.Provider>
    </CrmBreadcrumbRegistryContext.Provider>
  );
}

export function useCrmBreadcrumbTrail() {
  return useContext(CrmBreadcrumbItemsContext);
}

export function useCrmBreadcrumbs(overrides: BreadcrumbOverride[]) {
  const registrationId = useId();
  const registry = useContext(CrmBreadcrumbRegistryContext);
  const overridesKey = JSON.stringify(normalizeBreadcrumbOverrides(overrides));
  const normalizedOverrides = useMemo(
    () => JSON.parse(overridesKey) as BreadcrumbOverride[],
    [overridesKey],
  );

  useEffect(() => {
    if (!registry) {
      return;
    }

    registry.register(registrationId, normalizedOverrides);

    return () => {
      registry.unregister(registrationId);
    };
  }, [normalizedOverrides, registrationId, registry]);
}
