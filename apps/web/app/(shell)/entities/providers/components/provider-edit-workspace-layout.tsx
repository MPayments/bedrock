"use client";

import { useProviderDraftName } from "../lib/create-draft-name-context";
import { ProviderWorkspaceLayout } from "./provider-workspace-layout";
import { useEntityEditTitle } from "@/components/entities/workspace-layout";

type ProviderEditWorkspaceLayoutProps = {
  providerId: string;
  initialTitle: string;
  children: React.ReactNode;
};

export function ProviderEditWorkspaceLayout({
  providerId,
  initialTitle,
  children,
}: ProviderEditWorkspaceLayoutProps) {
  const { actions, meta } = useProviderDraftName();

  const title = useEntityEditTitle({
    id: providerId,
    initialTitle,
    bridge: {
      registerEdit: actions.registerEdit,
      clearEdit: actions.clearEdit,
      getEditLabel: meta.getEditLabel,
    },
  });

  return (
    <ProviderWorkspaceLayout title={title} subtitle="Карточка провайдера">
      {children}
    </ProviderWorkspaceLayout>
  );
}
