"use client";

import type { ReactNode } from "react";
import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  Wallet,
  Workflow,
} from "lucide-react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@bedrock/sdk-ui/components/tabs";

import { WorkspaceTabLabel } from "@/components/app/workspace-tab-label";

export type DealPageTab =
  | "overview"
  | "intake"
  | "pricing"
  | "documents"
  | "execution";

export const DEFAULT_DEAL_PAGE_TAB: DealPageTab = "overview";

export function isDealPageTab(value: string | null): value is DealPageTab {
  return (
    value === "overview" ||
    value === "intake" ||
    value === "pricing" ||
    value === "documents" ||
    value === "execution"
  );
}

type DealPageTabBadge = number | string | null;

type DealTabsProps = {
  activeTab: DealPageTab;
  badges?: Partial<Record<DealPageTab, DealPageTabBadge>>;
  documents: ReactNode;
  execution: ReactNode;
  intake: ReactNode;
  onTabChange: (tab: DealPageTab) => void;
  overview: ReactNode;
  pricing: ReactNode;
};

const DEAL_TAB_META: Array<{
  icon: typeof LayoutDashboard;
  label: string;
  value: DealPageTab;
}> = [
  {
    icon: LayoutDashboard,
    label: "Обзор",
    value: "overview",
  },
  {
    icon: ClipboardList,
    label: "Анкета",
    value: "intake",
  },
  {
    icon: Wallet,
    label: "Котировка и расчет",
    value: "pricing",
  },
  {
    icon: FileText,
    label: "Документы",
    value: "documents",
  },
  {
    icon: Workflow,
    label: "Исполнение",
    value: "execution",
  },
];

export function DealTabs({
  activeTab,
  badges,
  documents,
  execution,
  intake,
  onTabChange,
  overview,
  pricing,
}: DealTabsProps) {
  return (
    <Tabs
      className="w-full"
      value={activeTab}
      onValueChange={(value) => {
        if (isDealPageTab(value)) {
          onTabChange(value);
        }
      }}
    >
      <TabsList
        variant="line"
        className="w-full justify-start overflow-x-auto"
      >
        {DEAL_TAB_META.map((tab) => {
          return (
            <TabsTrigger
              key={tab.value}
              className="flex-none"
              data-testid={`deal-tab-${tab.value}`}
              value={tab.value}
            >
              <WorkspaceTabLabel
                count={badges?.[tab.value] ?? null}
                icon={tab.icon}
                label={tab.label}
              />
            </TabsTrigger>
          );
        })}
      </TabsList>

      <TabsContent className="space-y-6 pt-4" value="overview">
        {overview}
      </TabsContent>
      <TabsContent className="space-y-6 pt-4" value="intake">
        {intake}
      </TabsContent>
      <TabsContent className="space-y-6 pt-4" value="pricing">
        {pricing}
      </TabsContent>
      <TabsContent className="space-y-6 pt-4" value="documents">
        {documents}
      </TabsContent>
      <TabsContent className="space-y-6 pt-4" value="execution">
        {execution}
      </TabsContent>
    </Tabs>
  );
}
