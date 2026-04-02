import { Settings2 } from "lucide-react";

import { AgentCombobox } from "@/components/dashboard/AgentCombobox";
import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";

type AgreementOption = {
  contractNumber: string | null;
  id: string;
  isActive: boolean;
  versionNumber: number;
};

type DealManagementCardProps = {
  agreementId: string;
  agreementOptions: AgreementOption[];
  assigneeUserId: string | null;
  canChangeAgreement: boolean;
  canReassignAssignee: boolean;
  isUpdatingAgreement: boolean;
  isUpdatingAssignee: boolean;
  onAgreementChange: (agreementId: string) => void;
  onAssigneeChange: (assigneeUserId: string | undefined) => void;
};

function formatAgreementLabel(agreement: AgreementOption) {
  return `${agreement.contractNumber || "Договор без номера"} · версия ${
    agreement.versionNumber
  }${agreement.isActive ? "" : " · не активен"}`;
}

export function DealManagementCard({
  agreementId,
  agreementOptions,
  assigneeUserId,
  canChangeAgreement,
  canReassignAssignee,
  isUpdatingAgreement,
  isUpdatingAssignee,
  onAgreementChange,
  onAssigneeChange,
}: DealManagementCardProps) {
  const currentAgreement =
    agreementOptions.find((agreement) => agreement.id === agreementId) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-muted-foreground" />
          Управление сделкой
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Ответственный агент</Label>
          <AgentCombobox
            className="w-full"
            disabled={!canReassignAssignee || isUpdatingAssignee}
            value={assigneeUserId ?? undefined}
            onValueChange={onAssigneeChange}
          />
          {isUpdatingAssignee ? (
            <p className="text-xs text-muted-foreground">Сохраняем исполнителя...</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>Агентский договор</Label>
          <Select
            disabled={!canChangeAgreement || isUpdatingAgreement}
            value={agreementId}
            onValueChange={(value) => {
              if (value) {
                onAgreementChange(value);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите договор">
                {currentAgreement
                  ? formatAgreementLabel(currentAgreement)
                  : "Договор не найден"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {agreementOptions.map((agreement) => (
                <SelectItem key={agreement.id} value={agreement.id}>
                  {formatAgreementLabel(agreement)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!canChangeAgreement ? (
            <p className="text-xs text-muted-foreground">
              Договор можно менять только у черновика.
            </p>
          ) : null}
          {isUpdatingAgreement ? (
            <p className="text-xs text-muted-foreground">Обновляем договор...</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
