import { Save, RotateCcw } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@bedrock/sdk-ui/components/card";

import { DEAL_SECTION_LABELS } from "./constants";
import type { ApiDealSectionCompleteness } from "./types";
import {
  createDealIntakeFormContext,
  DealIntakeCommonSection,
  DealIntakeExternalBeneficiarySection,
  DealIntakeIncomingReceiptSection,
  DealIntakeMoneyRequestSection,
  DealIntakeSettlementDestinationSection,
} from "../../_components/deal-intake-form";
import type { IntakeEditorCardProps } from "./intake-editor-card.types";

type IntakeCardSectionId = ApiDealSectionCompleteness["sectionId"];

type IntakeCardDefinition = {
  sectionIds: IntakeCardSectionId[];
  title: string;
};

const INTAKE_CARD_DEFINITIONS = {
  basis: {
    sectionIds: ["incomingReceipt"],
    title: "Основание сделки",
  },
  execution: {
    sectionIds: ["externalBeneficiary", "settlementDestination"],
    title: "Реквизиты исполнения",
  },
  parameters: {
    sectionIds: ["common", "moneyRequest"],
    title: "Параметры сделки",
  },
} satisfies Record<string, IntakeCardDefinition>;

function IncompleteSectionChips({
  sectionCompleteness,
  sectionIds,
}: {
  sectionCompleteness: ApiDealSectionCompleteness[];
  sectionIds: IntakeCardSectionId[];
}) {
  const incompleteSections = sectionCompleteness.filter(
    (section) => sectionIds.includes(section.sectionId) && !section.complete,
  );

  if (incompleteSections.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {incompleteSections.map((section) => (
        <span
          key={section.sectionId}
          className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800"
        >
          {DEAL_SECTION_LABELS[section.sectionId] ?? section.sectionId}
        </span>
      ))}
    </div>
  );
}

export function IntakeEditorCard({
  applicantRequisites,
  currencyOptions,
  intake,
  isDirty,
  isSaving,
  counterparties,
  onChange,
  onReset,
  onSave,
  readOnly,
  sectionCompleteness,
}: IntakeEditorCardProps) {
  const context = createDealIntakeFormContext({
    applicantRequisites,
    currencyOptions,
    intake,
    counterparties,
    onChange,
    readOnly,
  });

  const shouldRenderBasisCard = context.hasIncomingReceiptSection;
  const shouldRenderExecutionCard =
    context.hasExternalBeneficiarySection ||
    context.hasSettlementDestinationSection;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <CardTitle>{INTAKE_CARD_DEFINITIONS.parameters.title}</CardTitle>
          <IncompleteSectionChips
            sectionCompleteness={sectionCompleteness}
            sectionIds={INTAKE_CARD_DEFINITIONS.parameters.sectionIds}
          />
        </CardHeader>
        <CardContent className="space-y-6">
          <DealIntakeCommonSection context={context} />
          <DealIntakeMoneyRequestSection context={context} />
        </CardContent>
      </Card>

      {shouldRenderBasisCard ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle>{INTAKE_CARD_DEFINITIONS.basis.title}</CardTitle>
            <IncompleteSectionChips
              sectionCompleteness={sectionCompleteness}
              sectionIds={INTAKE_CARD_DEFINITIONS.basis.sectionIds}
            />
          </CardHeader>
          <CardContent>
            <DealIntakeIncomingReceiptSection context={context} />
          </CardContent>
        </Card>
      ) : null}

      {shouldRenderExecutionCard ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle>{INTAKE_CARD_DEFINITIONS.execution.title}</CardTitle>
            <IncompleteSectionChips
              sectionCompleteness={sectionCompleteness}
              sectionIds={INTAKE_CARD_DEFINITIONS.execution.sectionIds}
            />
          </CardHeader>
          <CardContent className="space-y-6">
            <DealIntakeExternalBeneficiarySection context={context} />
            <DealIntakeSettlementDestinationSection context={context} />
          </CardContent>
        </Card>
      ) : null}

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
    </div>
  );
}
