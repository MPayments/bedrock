"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Button } from "@bedrock/sdk-ui/components/button";
import type { TreasuryOperationViewCounts } from "@bedrock/treasury/contracts";

import {
  getTreasuryOperationViewLabel,
  TREASURY_OPERATION_VIEW_KEYS,
  type TreasuryOperationSavedView,
} from "../lib/labels";

type TreasuryOperationsViewSwitcherProps = {
  viewCounts: TreasuryOperationViewCounts;
};

function getViewCount(
  counts: TreasuryOperationViewCounts,
  view: TreasuryOperationSavedView,
) {
  return counts[view];
}

export function TreasuryOperationsViewSwitcher({
  viewCounts,
}: TreasuryOperationsViewSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeView =
    (searchParams.get("view") as TreasuryOperationSavedView | null) ?? "all";

  return (
    <div className="flex flex-wrap gap-2">
      {TREASURY_OPERATION_VIEW_KEYS.map((view) => {
        const params = new URLSearchParams(searchParams.toString());

        if (view === "all") {
          params.delete("view");
        } else {
          params.set("view", view);
        }

        params.delete("page");

        const query = params.toString();
        const href = query ? `${pathname}?${query}` : pathname;
        const count = getViewCount(viewCounts, view);

        return (
          <Button
            key={view}
            size="sm"
            variant={activeView === view ? "default" : "outline"}
            nativeButton={false}
            render={<Link href={href} />}
          >
            {getTreasuryOperationViewLabel(view)}
            <span className="text-xs text-muted-foreground">{count}</span>
          </Button>
        );
      })}
    </div>
  );
}
