"use client";

import { usePathname } from "next/navigation";
import { Building2, Info, Users } from "lucide-react";

import {
  EntityWorkspaceLayout,
  EntityWorkspaceTabs,
  type EntityWorkspaceTab,
} from "@/components/entities/workspace-layout";

type CustomerWorkspaceTab = "info" | "counterparties";

type CustomerWorkspaceLayoutProps = {
  title: string;
  subtitle: string;
  disabledTabs?: CustomerWorkspaceTab[];
  children: React.ReactNode;
};

export function CustomerWorkspaceLayout({
  title,
  subtitle,
  disabledTabs = [],
  children,
}: CustomerWorkspaceLayoutProps) {
  const pathname = usePathname();
  const isTabDisabled = (tab: CustomerWorkspaceTab) =>
    disabledTabs.includes(tab);

  const currentTab = pathname.endsWith("/counterparties")
    ? "counterparties"
    : "info";

  const basePath = pathname.replace(/\/counterparties(?:\/.*)?$/, "");

  const tabs: EntityWorkspaceTab[] = [
    {
      id: "info",
      label: "Информация",
      icon: Info,
      href: basePath,
      disabled: isTabDisabled("info"),
    },
    {
      id: "counterparties",
      label: "Контрагенты",
      icon: Building2,
      href: `${basePath}/counterparties`,
      disabled: isTabDisabled("counterparties"),
    },
  ];

  return (
    <EntityWorkspaceLayout
      title={title}
      subtitle={subtitle}
      icon={Users}
      controls={<EntityWorkspaceTabs value={currentTab} tabs={tabs} />}
    >
      {children}
    </EntityWorkspaceLayout>
  );
}
