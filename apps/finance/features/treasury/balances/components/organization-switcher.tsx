"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";

import type { TreasuryBalancesOrganizationOption } from "../lib/presenter";

export function TreasuryBalancesOrganizationSwitcher({
  options,
  value,
}: {
  options: TreasuryBalancesOrganizationOption[];
  value: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const handleValueChange = React.useCallback(
    (nextValue: string | null) => {
      if (!nextValue) {
        return;
      }

      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set("organizationId", nextValue);

      const nextQuery = nextSearchParams.toString();

      startTransition(() => {
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, router, searchParams],
  );

  const currentLabel =
    options.find((option) => option.organizationId === value)
      ?.organizationName ?? "Выберите организацию";

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger
          aria-label="Выберите организацию для сводки"
          className="min-w-64 max-w-full bg-background/90"
          disabled={isPending}
        >
          <SelectValue placeholder={currentLabel}>{currentLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            {options.map((option) => (
              <SelectItem
                key={option.organizationId}
                value={option.organizationId}
              >
                {option.organizationName}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
