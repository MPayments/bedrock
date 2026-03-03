"use client";

import { usePathname } from "next/navigation";
import { BookOpen, Building2, Info, Wallet } from "lucide-react";

import {
  EntityWorkspaceLayout,
  EntityWorkspaceTabs,
  type EntityWorkspaceTab,
} from "@/components/entities/workspace-layout";

type CounterpartyWorkspaceTab = "general" | "accounts" | "documents";

type CounterpartyWorkspaceLayoutProps = {
  title: string;
  subtitle: string;
  disabledTabs?: CounterpartyWorkspaceTab[];
  children: React.ReactNode;
};

export function CounterpartyWorkspaceLayout({
  title,
  subtitle,
  disabledTabs = [],
  children,
}: CounterpartyWorkspaceLayoutProps) {
  const pathname = usePathname();
  const isTabDisabled = (tab: CounterpartyWorkspaceTab) =>
    disabledTabs.includes(tab);

  const currentTab = pathname.endsWith("/counterparty-accounts")
    ? "accounts"
    : pathname.endsWith("/documents")
      ? "documents"
      : "general";

  const basePath = pathname
    .replace(/\/counterparty-accounts(?:\/.*)?$/, "")
    .replace(/\/documents(?:\/.*)?$/, "");

  const tabs: EntityWorkspaceTab[] = [
    {
      id: "general",
      label: "Информация",
      icon: Info,
      href: basePath,
      disabled: isTabDisabled("general"),
    },
    {
      id: "counterparty-accounts",
      label: "Счета",
      icon: Wallet,
      href: `${basePath}/counterparty-accounts`,
      disabled: isTabDisabled("accounts"),
    },
    {
      id: "documents",
      label: "Документы",
      icon: BookOpen,
      href: `${basePath}/documents`,
      disabled: isTabDisabled("documents"),
    },
  ];

  return (
    <EntityWorkspaceLayout
      title={title}
      subtitle={subtitle}
      icon={Building2}
      controls={<EntityWorkspaceTabs value={currentTab} tabs={tabs} />}
    >
      {children}
    </EntityWorkspaceLayout>
  );
}
