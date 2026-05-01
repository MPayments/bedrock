import { RotateCcw, Save } from "lucide-react";

import { Button } from "@bedrock/sdk-ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@bedrock/sdk-ui/components/card";
import { Spinner } from "@bedrock/sdk-ui/components/spinner";

import {
  createDealIntakeFormContext,
  DealIntakeCommonSection,
  DealIntakeCustomerNoteField,
  DealIntakeExternalBeneficiarySection,
  DealIntakeIncomingReceiptSection,
  DealIntakeMoneyRequestSection,
  DealIntakePurposeField,
  DealIntakeSettlementDestinationSection,
} from "../../_components/deal-intake-form";
import { AttachmentListSection } from "./attachments-card";
import { DEAL_SECTION_LABELS } from "./constants";
import type { IntakeEditorCardProps } from "./intake-editor-card.types";
import type { ApiDealSectionCompleteness } from "./types";

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
  attachments,
  attachmentIngestions,
  currencyOptions,
  intake,
  isDirty,
  isSaving,
  counterparties,
  deletingAttachmentId,
  reingestingAttachmentId,
  onChange,
  onReset,
  onSave,
  onAttachmentDelete,
  onAttachmentDownload,
  onAttachmentReingest,
  onAttachmentUpload,
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
          <div className="grid gap-6 xl:grid-cols-2">
            <DealIntakeCommonSection context={context} hideCustomerNote />
            <DealIntakeMoneyRequestSection context={context} hidePurpose />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <DealIntakePurposeField context={context} />
            <DealIntakeCustomerNoteField context={context} />
          </div>
        </CardContent>
      </Card>

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

      {shouldRenderBasisCard ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle>{INTAKE_CARD_DEFINITIONS.basis.title}</CardTitle>
            <IncompleteSectionChips
              sectionCompleteness={sectionCompleteness}
              sectionIds={INTAKE_CARD_DEFINITIONS.basis.sectionIds}
            />
          </CardHeader>
          <CardContent className="space-y-6">
            <DealIntakeIncomingReceiptSection context={context} />
            <AttachmentListSection
              attachmentIngestions={attachmentIngestions}
              attachments={attachments}
              deletingAttachmentId={deletingAttachmentId}
              onDelete={onAttachmentDelete}
              onDownload={onAttachmentDownload}
              onReingest={onAttachmentReingest}
              onUpload={onAttachmentUpload}
              reingestingAttachmentId={reingestingAttachmentId}
            />
          </CardContent>
        </Card>
      ) : null}

      {isDirty && !readOnly ? (
        <div className="sticky bottom-0 z-20 flex flex-wrap justify-end gap-2 border-t bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
          <Button disabled={isSaving} onClick={onReset} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            Отменить изменения
          </Button>
          <Button disabled={isSaving} onClick={onSave}>
            {isSaving ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? "Сохранение..." : "Сохранить изменения"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
