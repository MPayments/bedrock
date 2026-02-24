"use client";

import {
  createDraftNameContext,
  type DraftNameContextValue,
} from "@/lib/resources/draft-name-context";

const { DraftNameProvider, useDraftNameContext } = createDraftNameContext({
  defaultCreateLabel: "Новая валюта",
  defaultEditLabel: "Валюта",
  hookName: "useCurrencyDraftName",
  providerName: "CurrencyDraftNameProvider",
});

export function CurrencyDraftNameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DraftNameProvider>{children}</DraftNameProvider>;
}

export function useCurrencyDraftName(): DraftNameContextValue {
  return useDraftNameContext();
}
