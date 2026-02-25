"use client";

import {
  createDraftNameContext,
  type DraftNameContextValue,
} from "@/lib/resources/draft-name-context";

const { DraftNameProvider, useDraftNameContext } = createDraftNameContext({
  defaultCreateLabel: "Новый счёт",
  defaultEditLabel: "Счёт",
  hookName: "useAccountDraftName",
  providerName: "AccountDraftNameProvider",
});

export function AccountDraftNameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DraftNameProvider>{children}</DraftNameProvider>;
}

export function useAccountDraftName(): DraftNameContextValue {
  return useDraftNameContext();
}
