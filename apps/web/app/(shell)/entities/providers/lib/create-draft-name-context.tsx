"use client";

import {
  createDraftNameContext,
  type DraftNameContextValue,
} from "@/lib/resources/draft-name-context";

const { DraftNameProvider, useDraftNameContext } = createDraftNameContext({
  defaultCreateLabel: "Новый провайдер",
  defaultEditLabel: "Провайдер",
  hookName: "useProviderDraftName",
  providerName: "ProviderDraftNameProvider",
});

export function ProviderDraftNameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DraftNameProvider>{children}</DraftNameProvider>;
}

export function useProviderDraftName(): DraftNameContextValue {
  return useDraftNameContext();
}
