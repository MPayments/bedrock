"use client";

import { usePathname } from "next/navigation";
import { Building2, Info } from "lucide-react";

import {
  EntityWorkspaceLayout,
  EntityWorkspaceTabs,
  type EntityWorkspaceTab,
} from "@/components/entities/workspace-layout";

type OrganizationWorkspaceLayoutProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function OrganizationWorkspaceLayout({
  title,
  subtitle,
  children,
}: OrganizationWorkspaceLayoutProps) {
  const pathname = usePathname();

  const tabs: EntityWorkspaceTab[] = [
    {
      id: "general",
      label: "Информация",
      icon: Info,
      href: pathname,
    },
  ];

  return (
    <EntityWorkspaceLayout
      title={title}
      subtitle={subtitle}
      icon={Building2}
      controls={<EntityWorkspaceTabs value="general" tabs={tabs} />}
    >
      {children}
    </EntityWorkspaceLayout>
  );
}
