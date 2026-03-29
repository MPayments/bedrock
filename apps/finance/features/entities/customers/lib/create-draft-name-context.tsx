"use client";

import {
  createDraftNameContext,
  type DraftNameContextValue,
} from "@/lib/resources/draft-name-context";

const { DraftNameProvider, useDraftNameContext } = createDraftNameContext({
  defaultCreateLabel: "Новый клиент",
  defaultEditLabel: "Клиент",
  hookName: "useCustomerDraftName",
  providerName: "CustomerDraftNameProvider",
});

export function CustomerDraftNameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DraftNameProvider>{children}</DraftNameProvider>;
}

export function useCustomerDraftName(): DraftNameContextValue {
  return useDraftNameContext();
}
