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

import { currencySymbol } from "@/features/treasury/rates/lib/format";

export type TreasuryBalancesEvaluationCurrencyOption = {
  currency: string;
  toneIndex: number;
};

function formatOptionLabel(currency: string) {
  return `${currency} · ${currencySymbol(currency)}`;
}

export function TreasuryBalancesEvaluationCurrencySwitcher({
  options,
  value,
}: {
  options: TreasuryBalancesEvaluationCurrencyOption[];
  value: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const handleValueChange = (nextValue: string | null) => {
    if (!nextValue) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("evaluationCurrency", nextValue);

    const nextQuery = nextSearchParams.toString();

    startTransition(() => {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    });
  };

  return (
    <Select value={value} onValueChange={handleValueChange}>
      <SelectTrigger
        aria-label="Выберите валюту оценки"
        className="h-9 w-[132px]"
        disabled={isPending}
      >
        <SelectValue placeholder={formatOptionLabel(value)}>
          {formatOptionLabel(value)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start">
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.currency} value={option.currency}>
              {formatOptionLabel(option.currency)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
