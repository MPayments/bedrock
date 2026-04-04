import { ClipboardList } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import { formatDealWorkflowMessage } from "./constants";

type EvidenceRequirement = {
  blockingReasons: string[];
  code: string;
  label: string;
  state: "missing" | "not_required" | "provided";
};

type EvidenceRequirementsCardProps = {
  requirements: EvidenceRequirement[];
};

const STATE_LABELS: Record<EvidenceRequirement["state"], string> = {
  missing: "Отсутствует",
  not_required: "Не требуется",
  provided: "Загружен",
};

export function EvidenceRequirementsCard({
  requirements,
}: EvidenceRequirementsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          Что нужно приложить
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {requirements.map((requirement) => (
            <div key={requirement.code} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{requirement.label}</div>
                <span className="text-sm text-muted-foreground">
                  {STATE_LABELS[requirement.state]}
                </span>
              </div>
              {requirement.blockingReasons.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {requirement.blockingReasons.map((reason) => (
                    <li key={reason}>{formatDealWorkflowMessage(reason)}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
