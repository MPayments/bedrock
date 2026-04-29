"use client";

import type { ReactNode } from "react";
import { Building2, FileImage, Wallet } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@bedrock/sdk-ui/components/tabs";

import { WorkspaceTabLabel } from "@/components/app/workspace-tab-label";

import type { OrganizationWorkspaceTab } from "../_lib/organization-workspace-api";

type OrganizationWorkspaceTabsProps = {
  activeTab: OrganizationWorkspaceTab;
  controls?: ReactNode;
  counts?: Partial<Record<OrganizationWorkspaceTab, number | string | null>>;
  onTabChange: (tab: OrganizationWorkspaceTab) => void;
};

export function OrganizationWorkspaceTabs({
  activeTab,
  controls,
  counts,
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
        <TabsList
          variant="line"
          className="w-full justify-start overflow-x-auto"
        >
          <TabsTrigger className="flex-none" value="organization">
            <WorkspaceTabLabel icon={Building2} label="Организация" />
          </TabsTrigger>
          <TabsTrigger className="flex-none" value="requisites">
            <WorkspaceTabLabel
              count={counts?.requisites ?? null}
              icon={Wallet}
              label="Реквизиты"
            />
          </TabsTrigger>
          <TabsTrigger className="flex-none" value="files">
            <WorkspaceTabLabel
              count={counts?.files ?? null}
              icon={FileImage}
              label="Файлы"
            />
          </TabsTrigger>
        </TabsList>
      </div>
    </Tabs>
  );
}
