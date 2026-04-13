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

function renderBadgeValue(value: DealPageTabBadge) {
  if (value === null || value === undefined || value === 0 || value === "0") {
    return null;
  }

  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      {value}
    </span>
  );
}

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
      <div className="space-y-4">
        <TabsList>
          {DEAL_TAB_META.map((tab) => {
            const Icon = tab.icon;

            return (
              <TabsTrigger
                key={tab.value}
                className="h-auto min-w-fit"
                data-testid={`deal-tab-${tab.value}`}
                value={tab.value}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {renderBadgeValue(badges?.[tab.value] ?? null)}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent className="space-y-6" value="overview">
          {overview}
        </TabsContent>
        <TabsContent className="space-y-6" value="intake">
          {intake}
        </TabsContent>
        <TabsContent className="space-y-6" value="pricing">
          {pricing}
        </TabsContent>
        <TabsContent className="space-y-6" value="documents">
          {documents}
        </TabsContent>
        <TabsContent className="space-y-6" value="execution">
          {execution}
        </TabsContent>
      </div>
    </Tabs>
  );
}
