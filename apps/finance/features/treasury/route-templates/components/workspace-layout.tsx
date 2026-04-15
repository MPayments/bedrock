"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, Workflow } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { Separator } from "@bedrock/sdk-ui/components/separator";

type RouteTemplateWorkspaceLayoutProps = {
  actions?: ReactNode;
  backHref?: string;
  children: ReactNode;
  title: string;
};

export function RouteTemplateWorkspaceLayout({
  actions,
  backHref,
  children,
  title,
}: RouteTemplateWorkspaceLayoutProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {backHref ? (
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={backHref} />}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Назад
            </Button>
          ) : null}
          <div className="rounded-lg bg-muted p-2.5">
            <Workflow className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h3 className="mb-1 truncate text-xl font-semibold">{title}</h3>
            <p className="hidden text-sm text-muted-foreground md:block">
              Шаблон маршрута казначейского исполнения
            </p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <Separator className="h-px w-full" />
      {children}
    </div>
  );
}
