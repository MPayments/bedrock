"use client";

import { usePathname } from "next/navigation";
import { Building2, Info, Wallet, Workflow } from "lucide-react";

import {
  EntityWorkspaceLayout,
  EntityWorkspaceTabs,
  type EntityWorkspaceTab,
} from "@/components/entities/workspace-layout";

type CounterpartyWorkspaceTab = "general" | "accounts" | "operations";

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
    : pathname.endsWith("/operations")
      ? "operations"
      : "general";

  const basePath = pathname
    .replace(/\/counterparty-accounts(?:\/.*)?$/, "")
    .replace(/\/operations(?:\/.*)?$/, "");

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
      id: "operations",
      label: "Операции",
      icon: Workflow,
      href: `${basePath}/operations`,
      disabled: isTabDisabled("operations"),
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
