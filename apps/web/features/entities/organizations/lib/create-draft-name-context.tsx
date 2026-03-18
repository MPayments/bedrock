"use client";

import {
  createDraftNameContext,
  type DraftNameContextValue,
} from "@/lib/resources/draft-name-context";

const { DraftNameProvider, useDraftNameContext } = createDraftNameContext({
  defaultCreateLabel: "Новая организация",
  defaultEditLabel: "Организация",
  hookName: "useOrganizationDraftName",
  providerName: "OrganizationDraftNameProvider",
});

export function OrganizationDraftNameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DraftNameProvider>{children}</DraftNameProvider>;
}

export function useOrganizationDraftName(): DraftNameContextValue {
  return useDraftNameContext();
}
