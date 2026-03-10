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

  const currentTab = pathname.endsWith("/parties/requisites")
    ? "accounts"
    : pathname.endsWith("/documents")
      ? "documents"
      : "general";

  const basePath = pathname
    .split("/parties/requisites")[0]!
    .split("/documents")[0]!;

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
      href: `${basePath}/parties/requisites`,
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
