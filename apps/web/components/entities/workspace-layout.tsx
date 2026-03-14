"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { LucideIcon } from "lucide-react";

import { Separator } from "@bedrock/sdk-ui/components/separator";
import { Tabs, TabsList, TabsTrigger } from "@bedrock/sdk-ui/components/tabs";

type EntityWorkspaceLayoutProps = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  children: React.ReactNode;
  controls?: React.ReactNode;
};

export function EntityWorkspaceLayout({
  title,
  subtitle,
  icon: Icon,
  controls,
  children,
}: EntityWorkspaceLayoutProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-muted rounded-lg p-2.5">
            <Icon className="text-muted-foreground h-5 w-5" />
          </div>
          <div>
            <h3 className="mb-1 text-xl font-semibold">{title}</h3>
            <p className="text-muted-foreground text-sm hidden md:block">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
      <Separator className="w-full h-px" />
      {controls}
      {children}
    </div>
  );
}

export type EntityWorkspaceTab = {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  disabled?: boolean;
};

type EntityWorkspaceTabsProps = {
  value: string;
  tabs: EntityWorkspaceTab[];
};

export function EntityWorkspaceTabs({ value, tabs }: EntityWorkspaceTabsProps) {
  return (
    <Tabs value={value} className="w-full p-1 block">
      <TabsList className="gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          if (tab.disabled) {
            return (
              <TabsTrigger key={tab.id} value={tab.id} disabled>
                <Icon size={16} />
                {tab.label}
              </TabsTrigger>
            );
          }

          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              nativeButton={false}
              render={<Link href={tab.href} />}
            >
              <Icon size={16} />
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

type EntityEditDraftNameBridge = {
  registerEdit: (id: string, name: string) => void;
  clearEdit: (id: string) => void;
  getEditLabel: (id: string, fallbackName?: string) => string;
};

type UseEntityEditTitleOptions = {
  id: string;
  initialTitle: string;
  bridge: EntityEditDraftNameBridge;
};

export function useEntityEditTitle({
  id,
  initialTitle,
  bridge,
}: UseEntityEditTitleOptions) {
  const { registerEdit, clearEdit, getEditLabel } = bridge;

  useEffect(() => {
    registerEdit(id, initialTitle);

    return () => {
      clearEdit(id);
    };
  }, [clearEdit, id, initialTitle, registerEdit]);

  return getEditLabel(id, initialTitle);
}
