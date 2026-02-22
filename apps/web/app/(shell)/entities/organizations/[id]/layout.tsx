"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Separator } from "@bedrock/ui/components/separator";
import { Tabs, TabsList, TabsTrigger } from "@bedrock/ui/components/tabs";
import { Building2, Info, Wallet, Workflow } from "lucide-react";

export default function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

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
            <h3 className="mb-1 text-xl font-semibold">ООО "Рога и копыта"</h3>
            <p className="text-muted-foreground text-sm hidden md:block">
              Карточка организации
            </p>
          </div>
        </div>
        {/* <Button size="lg">
        <Plus className="h-4 w-4" />
        <span className="hidden md:block">Добавить</span>
      </Button> */}
      </div>
      <Separator className="w-full h-px" />
      <Tabs value={currentTab} className="w-full p-1 block">
        <TabsList className="gap-2">
          <TabsTrigger
            value="general"
            nativeButton={false}
            render={<Link href={basePath} />}
          >
            <Info size={16} />
            Общая информация
          </TabsTrigger>
          <TabsTrigger
            value="accounts"
            nativeButton={false}
            render={<Link href={`${basePath}/accounts`} />}
          >
            <Wallet size={16} />
            Счета
          </TabsTrigger>
          <TabsTrigger
            value="operations"
            nativeButton={false}
            render={<Link href={`${basePath}/operations`} />}
          >
            <Workflow size={16} />
            Операции
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {children}
      {/* <Suspense
      fallback={
        <DataTableSkeleton columnCount={6} rowCount={10} filterCount={3} />
      }
    >
    </Suspense> */}
    </div>
  );
}
