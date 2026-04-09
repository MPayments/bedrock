"use client";

import type { ReactNode } from "react";
import { Building2, FileImage, Wallet } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@bedrock/sdk-ui/components/tabs";

import type { OrganizationWorkspaceTab } from "../_lib/organization-workspace-api";

type OrganizationWorkspaceTabsProps = {
  activeTab: OrganizationWorkspaceTab;
  controls?: ReactNode;
  onTabChange: (tab: OrganizationWorkspaceTab) => void;
};

export function OrganizationWorkspaceTabs({
  activeTab,
  controls,
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
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        {controls ? (
          <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-end lg:gap-3">
            {controls}
          </div>
        ) : null}
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
      </div>
    </Tabs>
  );
}
