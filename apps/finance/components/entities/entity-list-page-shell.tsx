import { Suspense } from "react";
import type { LucideIcon } from "lucide-react";

import { Separator } from "@bedrock/sdk-ui/components/separator";

type EntityListPageShellProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: React.ReactNode;
  fallback: React.ReactNode;
  children: React.ReactNode;
};

export function EntityListPageShell({
  icon: Icon,
  title,
  description,
  actions,
  fallback,
  children,
}: EntityListPageShellProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="bg-muted rounded-lg p-2.5">
            <Icon className="text-muted-foreground h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="mb-1 text-xl font-semibold">{title}</h3>
            <p className="text-muted-foreground text-sm hidden md:block">
              {description}
            </p>
          </div>
        </div>
        {actions ? <div className="shrink-0 self-start">{actions}</div> : null}
      </div>
      <Separator className="w-full h-px" />
      <Suspense fallback={fallback}>{children}</Suspense>
    </div>
  );
}
