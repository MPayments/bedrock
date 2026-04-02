import { Save, RotateCcw } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import {
  DealIntakeForm,
  type CrmApplicantRequisiteOption,
  type CrmCurrencyOption,
  type CrmCustomerLegalEntityOption,
  type CrmDealIntakeDraft,
} from "../../_components/deal-intake-form";
import type { ApiDealSectionCompleteness } from "./types";

type IntakeEditorCardProps = {
  applicantRequisites: CrmApplicantRequisiteOption[];
  currencyOptions: CrmCurrencyOption[];
  intake: CrmDealIntakeDraft;
  isDirty: boolean;
  isSaving: boolean;
  legalEntities: CrmCustomerLegalEntityOption[];
  onChange: (next: CrmDealIntakeDraft) => void;
  onReset: () => void;
  onSave: () => void;
  readOnly: boolean;
  sectionCompleteness: ApiDealSectionCompleteness[];
};

export function IntakeEditorCard({
  applicantRequisites,
  currencyOptions,
  intake,
  isDirty,
  isSaving,
  legalEntities,
  onChange,
  onReset,
  onSave,
  readOnly,
  sectionCompleteness,
}: IntakeEditorCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Анкета сделки</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            CRM редактирует полный typed intake сделки и сохраняет его как
            текущую версию анкеты.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sectionCompleteness
            .filter((section) => !section.complete)
            .map((section) => (
              <span
                key={section.sectionId}
                className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800"
              >
                {section.sectionId}
              </span>
            ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <DealIntakeForm
          applicantRequisites={applicantRequisites}
          currencyOptions={currencyOptions}
          intake={intake}
          legalEntities={legalEntities}
          onChange={onChange}
          readOnly={readOnly}
        />

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button
            disabled={readOnly || !isDirty || isSaving}
            onClick={onReset}
            variant="outline"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Сбросить
          </Button>
          <Button
            disabled={readOnly || !isDirty || isSaving}
            onClick={onSave}
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Сохранение..." : "Сохранить анкету"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
