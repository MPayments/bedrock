"use client";

import { Building2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@bedrock/sdk-ui/components/select";

import {
  isPrimaryCounterparty,
  type CustomerCounterparty,
  type CustomerWorkspaceDetail,
} from "../lib/customer-detail";

type CustomerCounterpartySelectProps = {
  activeCounterpartyId: string;
  counterparties: CustomerCounterparty[];
  onValueChange: (counterpartyId: string) => void;
  workspace: Pick<
    CustomerWorkspaceDetail,
    "counterparties" | "primaryCounterpartyId"
  >;
};

export function CustomerCounterpartySelect({
  activeCounterpartyId,
  counterparties,
  onValueChange,
  workspace,
}: CustomerCounterpartySelectProps) {
  const activeCounterparty =
    counterparties.find(
      (partyProfile) => partyProfile.counterpartyId === activeCounterpartyId,
    ) ?? null;

  if (!activeCounterparty) {
    return null;
  }

  return (
    <Select
      value={activeCounterpartyId}
      onValueChange={(value) => {
        if (value) {
          onValueChange(value);
        }
      }}
    >
      <SelectTrigger className="h-auto w-full min-w-0 justify-start gap-3 px-3 py-2 max-w-[420px] bg-card">
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate font-medium">
            {activeCounterparty.shortName}
          </div>
        </div>
      </SelectTrigger>
      <SelectContent align="end">
        {counterparties.map((partyProfile) => {
          const isPrimary = isPrimaryCounterparty(
            workspace,
            partyProfile.counterpartyId,
          );

          return (
            <SelectItem
              key={partyProfile.counterpartyId}
              value={partyProfile.counterpartyId}
              className="items-start py-2"
            >
              <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex flex-1 flex-col items-start">
                <span className="truncate font-medium">
                  {partyProfile.shortName}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {partyProfile.inn ? (
                    <span className="truncate">ИНН: {partyProfile.inn}</span>
                  ) : (
                    <span>ИНН не указан</span>
                  )}
                  {isPrimary ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                      Основное
                    </span>
                  ) : null}
                </span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
