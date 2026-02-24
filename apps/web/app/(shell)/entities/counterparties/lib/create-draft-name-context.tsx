"use client";

import {
  createDraftNameContext,
  type DraftNameContextValue,
} from "@/lib/resources/draft-name-context";

const { DraftNameProvider, useDraftNameContext } = createDraftNameContext({
  defaultCreateLabel: "Новый контрагент",
  defaultEditLabel: "Контрагент",
  hookName: "useCounterpartyDraftName",
  providerName: "CounterpartyDraftNameProvider",
});

export function CounterpartyDraftNameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DraftNameProvider>{children}</DraftNameProvider>;
}

export function useCounterpartyDraftName(): DraftNameContextValue {
  return useDraftNameContext();
}
