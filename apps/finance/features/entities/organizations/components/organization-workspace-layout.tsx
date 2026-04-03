"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { BookOpen, Building2, Info, Wallet } from "lucide-react";

import {
  EntityWorkspaceLayout,
  EntityWorkspaceTabs,
  type EntityWorkspaceTab,
} from "@/components/entities/workspace-layout";

type OrganizationWorkspaceTab = "general" | "accounts" | "documents";

type OrganizationWorkspaceLayoutProps = {
  title: string;
  subtitle: string;
  disabledTabs?: OrganizationWorkspaceTab[];
  children?: React.ReactNode;
};

export function OrganizationWorkspaceLayout({
  title,
  subtitle,
  disabledTabs = [],
  children,
}: OrganizationWorkspaceLayoutProps) {
  const pathname = usePathname();
  const isTabDisabled = (tab: OrganizationWorkspaceTab) =>
    disabledTabs.includes(tab);

  const currentTab = pathname.endsWith("/requisites")
    ? "accounts"
    : pathname.endsWith("/documents")
      ? "documents"
      : "general";

  const basePath = pathname
    .replace(/\/requisites(?:\/.*)?$/, "")
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
      id: "accounts",
      label: "Реквизиты",
      icon: Wallet,
      href: `${basePath}/requisites`,
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
