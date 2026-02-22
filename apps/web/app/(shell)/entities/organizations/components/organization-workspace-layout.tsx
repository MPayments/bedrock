"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@bedrock/ui/components/separator";
import { Tabs, TabsList, TabsTrigger } from "@bedrock/ui/components/tabs";
import { Building2, Info, Wallet, Workflow } from "lucide-react";

type OrganizationWorkspaceTab = "general" | "accounts" | "operations";

type OrganizationWorkspaceLayoutProps = {
  title: string;
  subtitle: string;
  disabledTabs?: OrganizationWorkspaceTab[];
  children: React.ReactNode;
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

  const currentTab = pathname.endsWith("/accounts")
    ? "accounts"
    : pathname.endsWith("/operations")
      ? "operations"
      : "general";

  const basePath = pathname
    .replace(/\/accounts(?:\/.*)?$/, "")
    .replace(/\/operations(?:\/.*)?$/, "");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-muted rounded-lg p-2.5">
            <Building2 className="text-muted-foreground h-5 w-5" />
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
      <Tabs value={currentTab} className="w-full p-1 block">
        <TabsList className="gap-2">
          {isTabDisabled("general") ? (
            <TabsTrigger value="general" disabled>
              <Info size={16} />
              Общая информация
            </TabsTrigger>
          ) : (
            <TabsTrigger
              value="general"
              nativeButton={false}
              render={<Link href={basePath} />}
            >
              <Info size={16} />
              Общая информация
            </TabsTrigger>
          )}
          {isTabDisabled("accounts") ? (
            <TabsTrigger value="accounts" disabled>
              <Wallet size={16} />
              Счета
            </TabsTrigger>
          ) : (
            <TabsTrigger
              value="accounts"
              nativeButton={false}
              render={<Link href={`${basePath}/accounts`} />}
            >
              <Wallet size={16} />
              Счета
            </TabsTrigger>
          )}
          {isTabDisabled("operations") ? (
            <TabsTrigger value="operations" disabled>
              <Workflow size={16} />
              Операции
            </TabsTrigger>
          ) : (
            <TabsTrigger
              value="operations"
              nativeButton={false}
              render={<Link href={`${basePath}/operations`} />}
            >
              <Workflow size={16} />
              Операции
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>
      {children}
    </div>
  );
}
