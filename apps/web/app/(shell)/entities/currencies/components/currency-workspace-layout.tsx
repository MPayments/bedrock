"use client";

import { DollarSign } from "lucide-react";

import { Separator } from "@bedrock/ui/components/separator";

type CurrencyWorkspaceLayoutProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export function CurrencyWorkspaceLayout({
  title,
  subtitle,
  children,
}: CurrencyWorkspaceLayoutProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-muted rounded-lg p-2.5">
            <DollarSign className="text-muted-foreground h-5 w-5" />
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
      {children}
    </div>
  );
}
