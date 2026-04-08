"use client";

import { Building2, FileImage, Wallet } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@bedrock/sdk-ui/components/tabs";

import type { OrganizationWorkspaceTab } from "../_lib/organization-workspace-api";

type OrganizationWorkspaceTabsProps = {
  activeTab: OrganizationWorkspaceTab;
  onTabChange: (tab: OrganizationWorkspaceTab) => void;
};

export function OrganizationWorkspaceTabs({
  activeTab,
  onTabChange,
}: OrganizationWorkspaceTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (value === "organization" || value === "requisites" || value === "files") {
          onTabChange(value);
        }
      }}
      className="w-full"
    >
      <TabsList className="gap-2">
        <TabsTrigger value="organization">
          <Building2 className="size-4" />
          Организация
        </TabsTrigger>
        <TabsTrigger value="requisites">
          <Wallet className="size-4" />
          Реквизиты
        </TabsTrigger>
        <TabsTrigger value="files">
          <FileImage className="size-4" />
          Файлы
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
