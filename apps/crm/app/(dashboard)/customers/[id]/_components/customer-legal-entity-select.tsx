"use client";

import { Building2 } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@bedrock/sdk-ui/components/select";

import {
  isPrimaryLegalEntity,
  type CustomerLegalEntity,
  type CustomerWorkspaceDetail,
} from "../_lib/customer-detail";

type CustomerLegalEntitySelectProps = {
  activeCounterpartyId: string;
  legalEntities: CustomerLegalEntity[];
  onValueChange: (counterpartyId: string) => void;
  workspace: Pick<
    CustomerWorkspaceDetail,
    "legalEntities" | "primaryCounterpartyId"
  >;
};

export function CustomerLegalEntitySelect({
  activeCounterpartyId,
  legalEntities,
  onValueChange,
  workspace,
}: CustomerLegalEntitySelectProps) {
  const activeLegalEntity =
    legalEntities.find(
      (legalEntity) => legalEntity.counterpartyId === activeCounterpartyId,
    ) ?? null;

  if (!activeLegalEntity) {
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
            {activeLegalEntity.shortName}
          </div>
        </div>
      </SelectTrigger>
      <SelectContent align="end">
        {legalEntities.map((legalEntity) => {
          const isPrimary = isPrimaryLegalEntity(
            workspace,
            legalEntity.counterpartyId,
          );

          return (
            <SelectItem
              key={legalEntity.counterpartyId}
              value={legalEntity.counterpartyId}
              className="items-start py-2"
            >
              <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex flex-1 flex-col items-start">
                <span className="truncate font-medium">
                  {legalEntity.shortName}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {legalEntity.inn ? (
                    <span className="truncate">ИНН: {legalEntity.inn}</span>
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
