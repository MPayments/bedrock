"use client";

import { Archive, ClipboardList, Workflow } from "lucide-react";

import {
  EntityWorkspaceTabs,
  type EntityWorkspaceTab,
} from "@/components/entities/workspace-layout";

type TreasuryOperationsTabsProps = {
  value: string;
};

const tabs: EntityWorkspaceTab[] = [
  {
    href: "/treasury/operations?view=runtime",
    icon: Workflow,
    id: "runtime",
    label: "Исполнение",
  },
  {
    href: "/treasury/operations?view=orders",
    icon: ClipboardList,
    id: "orders",
    label: "Ордера",
  },
  {
    href: "/treasury/operations?view=inventory",
    icon: Archive,
    id: "inventory",
    label: "Инвентарь",
  },
];

export function TreasuryOperationsTabs({ value }: TreasuryOperationsTabsProps) {
  return <EntityWorkspaceTabs value={value} tabs={tabs} />;
}
