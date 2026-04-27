"use client";

import { CountrySelect } from "@bedrock/sdk-ui/components/country-select";
import { DatePicker } from "@bedrock/sdk-ui/components/date-picker";
import { Input } from "@bedrock/sdk-ui/components/input";
import { Label } from "@bedrock/sdk-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bedrock/sdk-ui/components/select";
import { Textarea } from "@bedrock/sdk-ui/components/textarea";

export type CrmDealType =
  | "payment"
  | "currency_exchange"
  | "currency_transit"
  | "exporter_settlement";

export type CrmDealIntakeDraft = {
  common: {
    applicantCounterpartyId: string | null;
    customerNote: string | null;
    requestedExecutionDate: string | null;
  };
  externalBeneficiary: {
    bankInstructionSnapshot: CrmBankInstructionSnapshot | null;
    beneficiaryCounterpartyId: string | null;
    beneficiarySnapshot: CrmCounterpartySnapshot | null;
  };
  incomingReceipt: {
    contractNumber: string | null;
    expectedAmount: string | null;
    expectedAt: string | null;
    invoiceNumber: string | null;
    payerCounterpartyId: string | null;
    payerSnapshot: CrmCounterpartySnapshot | null;
  };
  moneyRequest: {
    purpose: string | null;
    sourceAmount: string | null;
    sourceCurrencyId: string | null;
    targetCurrencyId: string | null;
  };
  settlementDestination: {
    bankInstructionSnapshot: CrmBankInstructionSnapshot | null;
    mode: "applicant_requisite" | "manual" | null;
    requisiteId: string | null;
  };
  type: CrmDealType;
};

export type CrmCounterpartySnapshot = {
  country: string | null;
  displayName: string | null;
  inn: string | null;
  legalName: string | null;
};

export type CrmBankInstructionSnapshot = {
  accountNo: string | null;
  bankAddress: string | null;
  bankCountry: string | null;
  bankName: string | null;
  beneficiaryName: string | null;
  bic: string | null;
  iban: string | null;
  label: string | null;
  swift: string | null;
};

export type CrmCustomerCounterpartyOption = {
  counterpartyId: string;
  fullName: string;
  inn: string | null;
  orgName: string;
  shortName: string;
};

export type CrmCurrencyOption = {
  code: string;
  id: string;
  label: string;
  name: string;
};

export type CrmApplicantRequisiteOption = {
  accountNo: string | null;
  beneficiaryName: string | null;
  iban: string | null;
  id: string;
  label: string;
  providerLabel: string | null;
};

export type DealIntakeFormProps = {
  applicantRequisites: CrmApplicantRequisiteOption[];
  currencyOptions: CrmCurrencyOption[];
  intake: CrmDealIntakeDraft;
  counterparties: CrmCustomerCounterpartyOption[];
  moneyRequestLayout?: "inline" | "stacked";
  onChange: (next: CrmDealIntakeDraft) => void;
  readOnly?: boolean;
};

function resolveOptionLabel(input: {
  value: string | null;
  emptyLabel: string;
  loadingLabel: string;
  missingLabel: string;
  optionsCount: number;
  matchedLabel: string | null;
}) {
  if (!input.value) {
    return input.emptyLabel;
  }

  if (input.matchedLabel) {
    return input.matchedLabel;
  }

  if (input.optionsCount === 0) {
    return input.loadingLabel;
  }

  return input.missingLabel;
}

function emptyCounterpartySnapshot(): CrmCounterpartySnapshot {
  return {
    country: null,
    displayName: null,
    inn: null,
    legalName: null,
  };
}

function emptyBankInstructionSnapshot(): CrmBankInstructionSnapshot {
  return {
    accountNo: null,
    bankAddress: null,
    bankCountry: null,
    bankName: null,
    beneficiaryName: null,
    bic: null,
    iban: null,
    label: null,
    swift: null,
  };
}

export function createEmptyCrmDealIntake(input: {
  applicantCounterpartyId: string | null;
  type: CrmDealType;
}): CrmDealIntakeDraft {
  return {
    common: {
      applicantCounterpartyId: input.applicantCounterpartyId,
      customerNote: null,
      requestedExecutionDate: null,
    },
    externalBeneficiary: {
      bankInstructionSnapshot: null,
      beneficiaryCounterpartyId: null,
      beneficiarySnapshot: null,
    },
    incomingReceipt: {
      contractNumber: null,
      expectedAmount: null,
      expectedAt: null,
      invoiceNumber: null,
      payerCounterpartyId: null,
      payerSnapshot: null,
    },
    moneyRequest: {
      purpose: null,
      sourceAmount: null,
      sourceCurrencyId: null,
      targetCurrencyId: null,
    },
    settlementDestination: {
      bankInstructionSnapshot: null,
      mode: null,
      requisiteId: null,
    },
    type: input.type,
  };
}

function toDatePickerValue(value: string | null) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function toDateStorageValue(value: Date | undefined) {
  if (!value) {
    return null;
  }

  return new Date(
    Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
  ).toISOString();
}

function snapshotFieldValue(value: string | null) {
  return value ?? "";
}

function shouldRenderIncomingReceipt(type: CrmDealType) {
  return (
    type === "payment" ||
    type === "currency_transit" ||
    type === "exporter_settlement"
  );
}

function shouldRenderIncomingReceiptPayer(type: CrmDealType) {
  return type === "currency_transit" || type === "exporter_settlement";
}

function shouldRenderExternalBeneficiary(type: CrmDealType) {
  return type === "payment" || type === "currency_transit";
}

function shouldRenderSettlementDestination(type: CrmDealType) {
  return type === "currency_exchange" || type === "exporter_settlement";
}

export function createDealIntakeFormContext({
  applicantRequisites,
  currencyOptions,
  intake,
  counterparties,
  moneyRequestLayout = "stacked",
  onChange,
  readOnly = false,
}: DealIntakeFormProps) {
  const applicantSnapshot =
    intake.incomingReceipt.payerSnapshot ?? emptyCounterpartySnapshot();
  const beneficiarySnapshot =
    intake.externalBeneficiary.beneficiarySnapshot ??
    emptyCounterpartySnapshot();
  const beneficiaryBank =
    intake.externalBeneficiary.bankInstructionSnapshot ??
    emptyBankInstructionSnapshot();
  const settlementBank =
    intake.settlementDestination.bankInstructionSnapshot ??
    emptyBankInstructionSnapshot();
  const selectedApplicant =
    counterparties.find(
      (partyProfile) =>
        partyProfile.counterpartyId === intake.common.applicantCounterpartyId,
    ) ?? null;
  const selectedSourceCurrency =
    currencyOptions.find(
      (currency) => currency.id === intake.moneyRequest.sourceCurrencyId,
    ) ?? null;
  const selectedTargetCurrency =
    currencyOptions.find(
      (currency) => currency.id === intake.moneyRequest.targetCurrencyId,
    ) ?? null;
  const selectedApplicantRequisite =
    applicantRequisites.find(
      (requisite) => requisite.id === intake.settlementDestination.requisiteId,
    ) ?? null;
  const isPaymentDeal = intake.type === "payment";
  const shouldInlineMoneyRequestFields = moneyRequestLayout === "inline";
  const moneyRequestSectionTitle = isPaymentDeal
    ? "Параметры платежа"
    : "Сумма и валюта сделки";
  const primaryAmountLabel = isPaymentDeal
    ? "Сумма к выплате бенефициару"
    : "Сумма";
  const sourceCurrencyTitle = isPaymentDeal
    ? "Валюта списания / фондирования"
    : "Валюта списания";
  const targetCurrencyTitle = isPaymentDeal
    ? "Валюта выплаты"
    : "Целевая валюта";
  const incomingReceiptCurrencyTitle = isPaymentDeal
    ? "Валюта выплаты"
    : "Валюта поступления";
  const incomingReceiptSectionTitle = isPaymentDeal
    ? "Инвойс поставщика"
    : "Входящее поступление";
  const incomingReceiptSectionDescription = isPaymentDeal
    ? "Данные из инвойса поставщика: сумма, номер и договор. Их можно заполнить вручную или подтянуть из OCR."
    : "Данные о платеже, который ожидается от покупателя или плательщика.";
  const expectedAmountLabel = isPaymentDeal
    ? "Сумма к выплате бенефициару"
    : "Ожидаемая сумма";
  const expectedDateLabel = isPaymentDeal
    ? "Плановая дата выплаты"
    : "Ожидаемая дата поступления";
  const shouldRenderPayerDetails = shouldRenderIncomingReceiptPayer(
    intake.type,
  );
  const primaryAmountValue = isPaymentDeal
    ? snapshotFieldValue(intake.incomingReceipt.expectedAmount)
    : snapshotFieldValue(intake.moneyRequest.sourceAmount);
  const selectedApplicantLabel = resolveOptionLabel({
    emptyLabel: "Не выбрано",
    loadingLabel: "Загрузка контрагентов...",
    matchedLabel: selectedApplicant
      ? `${selectedApplicant.shortName}${
          selectedApplicant.inn ? ` · ИНН ${selectedApplicant.inn}` : ""
        }`
      : null,
    missingLabel: "Выбранный контрагент недоступен",
    optionsCount: counterparties.length,
    value: intake.common.applicantCounterpartyId,
  });
  const sourceCurrencyLabel = resolveOptionLabel({
    emptyLabel: "Не выбрано",
    loadingLabel: "Загрузка валют...",
    matchedLabel: selectedSourceCurrency?.label ?? null,
    missingLabel: "Выбранная валюта недоступна",
    optionsCount: currencyOptions.length,
    value: intake.moneyRequest.sourceCurrencyId,
  });
  const targetCurrencyLabel = resolveOptionLabel({
    emptyLabel: isPaymentDeal ? "Не выбрано" : "Без конвертации",
    loadingLabel: "Загрузка валют...",
    matchedLabel: selectedTargetCurrency?.label ?? null,
    missingLabel: "Выбранная валюта недоступна",
    optionsCount: currencyOptions.length,
    value: intake.moneyRequest.targetCurrencyId,
  });
  const settlementModeLabel =
    intake.settlementDestination.mode === "applicant_requisite"
      ? "На реквизиты заявителя"
      : intake.settlementDestination.mode === "manual"
        ? "На вручную введенные реквизиты"
        : "Не выбрано";
  const applicantRequisiteLabel = resolveOptionLabel({
    emptyLabel: "Не выбрано",
    loadingLabel: "Загрузка реквизитов...",
    matchedLabel: selectedApplicantRequisite
      ? `${selectedApplicantRequisite.label}${
          selectedApplicantRequisite.providerLabel
            ? ` · ${selectedApplicantRequisite.providerLabel}`
            : ""
        }`
      : null,
    missingLabel: "Выбранные реквизиты недоступны",
    optionsCount: applicantRequisites.length,
    value: intake.settlementDestination.requisiteId,
  });

  function update(next: Partial<CrmDealIntakeDraft>) {
    onChange({
      ...intake,
      ...next,
    });
  }

  function updateCommon(
    key: keyof CrmDealIntakeDraft["common"],
    value: string | null,
  ) {
    update({
      common: {
        ...intake.common,
        [key]: value,
      },
    });
  }

  function updateMoneyRequest(
    key: keyof CrmDealIntakeDraft["moneyRequest"],
    value: string | null,
  ) {
    update({
      moneyRequest: {
        ...intake.moneyRequest,
        [key]: value,
      },
    });
  }

  function updatePrimaryAmount(value: string | null) {
    if (isPaymentDeal) {
      updateIncomingReceipt("expectedAmount", value);
      return;
    }

    updateMoneyRequest("sourceAmount", value);
  }

  function updateIncomingReceipt(
    key: keyof CrmDealIntakeDraft["incomingReceipt"],
    value: string | null,
  ) {
    update({
      incomingReceipt: {
        ...intake.incomingReceipt,
        [key]: value,
      },
    });
  }

  function updatePayerSnapshot(
    key: keyof CrmCounterpartySnapshot,
    value: string | null,
  ) {
    update({
      incomingReceipt: {
        ...intake.incomingReceipt,
        payerSnapshot: {
          ...applicantSnapshot,
          [key]: value,
        },
      },
    });
  }

  function updateBeneficiarySnapshot(
    key: keyof CrmCounterpartySnapshot,
    value: string | null,
  ) {
    update({
      externalBeneficiary: {
        ...intake.externalBeneficiary,
        beneficiarySnapshot: {
          ...beneficiarySnapshot,
          [key]: value,
        },
      },
    });
  }

  function updateBeneficiaryBank(
    key: keyof CrmBankInstructionSnapshot,
    value: string | null,
  ) {
    update({
      externalBeneficiary: {
        ...intake.externalBeneficiary,
        bankInstructionSnapshot: {
          ...beneficiaryBank,
          [key]: value,
        },
      },
    });
  }

  function updateSettlementBank(
    key: keyof CrmBankInstructionSnapshot,
    value: string | null,
  ) {
    update({
      settlementDestination: {
        ...intake.settlementDestination,
        bankInstructionSnapshot: {
          ...settlementBank,
          [key]: value,
        },
      },
    });
  }

  return {
    applicantRequisites,
    applicantSnapshot,
    applicantRequisiteLabel,
    beneficiaryBank,
    beneficiarySnapshot,
    currencyOptions,
    expectedAmountLabel,
    expectedDateLabel,
    hasExternalBeneficiarySection: shouldRenderExternalBeneficiary(intake.type),
    hasIncomingReceiptSection: shouldRenderIncomingReceipt(intake.type),
    hasSettlementDestinationSection: shouldRenderSettlementDestination(
      intake.type,
    ),
    incomingReceiptSectionDescription,
    incomingReceiptSectionTitle,
    intake,
    isPaymentDeal,
    counterparties,
    moneyRequestSectionTitle,
    primaryAmountLabel,
    primaryAmountValue,
    readOnly,
    selectedApplicantLabel,
    settlementBank,
    settlementModeLabel,
    shouldInlineMoneyRequestFields,
    shouldRenderPayerDetails,
    incomingReceiptCurrencyTitle,
    sourceCurrencyLabel,
    sourceCurrencyTitle,
    targetCurrencyLabel,
    targetCurrencyTitle,
    hasDedicatedIncomingReceiptCurrency:
      shouldRenderIncomingReceipt(intake.type) && !isPaymentDeal,
    update,
    updateBeneficiaryBank,
    updateBeneficiarySnapshot,
    updateCommon,
    updateIncomingReceipt,
    updateMoneyRequest,
    updatePayerSnapshot,
    updatePrimaryAmount,
    updateSettlementBank,
  };
}

export type DealIntakeFormContext = ReturnType<
  typeof createDealIntakeFormContext
>;

type DealIntakeSectionProps = {
  context: DealIntakeFormContext;
};

export function DealIntakeCommonSection({ context }: DealIntakeSectionProps) {
  const {
    intake,
    counterparties,
    readOnly,
    selectedApplicantLabel,
    updateCommon,
  } = context;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-medium">Общие данные</h3>
      </div>
      <div className="grid gap-4">
        <div className="min-w-0 max-w-full space-y-2">
          <Label>Контрагент заявителя</Label>
          <Select
            disabled={readOnly}
            value={intake.common.applicantCounterpartyId ?? "__none"}
            onValueChange={(value) =>
              updateCommon(
                "applicantCounterpartyId",
                value === "__none" ? null : value,
              )
            }
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue
                className="min-w-0 truncate"
                placeholder="Выберите контрагента"
              >
                {selectedApplicantLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Не выбрано</SelectItem>
              {counterparties.map((partyProfile) => (
                <SelectItem
                  key={partyProfile.counterpartyId}
                  value={partyProfile.counterpartyId}
                >
                  {partyProfile.shortName}
                  {partyProfile.inn ? ` · ИНН ${partyProfile.inn}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 space-y-2">
          <Label htmlFor="deal-requested-execution-date">
            Желаемая дата исполнения
          </Label>
          <DatePicker
            id="deal-requested-execution-date"
            disabled={readOnly}
            className="w-full"
            value={toDatePickerValue(intake.common.requestedExecutionDate)}
            onChange={(date) =>
              updateCommon("requestedExecutionDate", toDateStorageValue(date))
            }
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="deal-customer-note">Комментарий клиента</Label>
        <Textarea
          id="deal-customer-note"
          disabled={readOnly}
          rows={3}
          value={snapshotFieldValue(intake.common.customerNote)}
          onChange={(event) =>
            updateCommon("customerNote", event.target.value || null)
          }
        />
      </div>
    </section>
  );
}

export function DealIntakeMoneyRequestSection({
  context,
}: DealIntakeSectionProps) {
  const {
    hasDedicatedIncomingReceiptCurrency,
    currencyOptions,
    intake,
    moneyRequestSectionTitle,
    primaryAmountLabel,
    primaryAmountValue,
    readOnly,
    shouldInlineMoneyRequestFields,
    sourceCurrencyLabel,
    sourceCurrencyTitle,
    targetCurrencyLabel,
    targetCurrencyTitle,
    updateMoneyRequest,
    updatePrimaryAmount,
  } = context;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-medium">{moneyRequestSectionTitle}</h3>
      </div>
      <div
        className={
          shouldInlineMoneyRequestFields
            ? "grid grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)] gap-4"
            : "grid gap-4"
        }
      >
        <div className="min-w-0 space-y-2">
          <Label htmlFor="deal-primary-amount">{primaryAmountLabel}</Label>
          <Input
            id="deal-primary-amount"
            data-testid="deal-primary-amount-input"
            disabled={readOnly}
            inputMode="decimal"
            value={primaryAmountValue}
            onChange={(event) =>
              updatePrimaryAmount(event.target.value || null)
            }
          />
        </div>
        {!hasDedicatedIncomingReceiptCurrency ? (
          <div className="min-w-0 space-y-2">
            <Label>{targetCurrencyTitle}</Label>
            <Select
              disabled={readOnly}
              value={intake.moneyRequest.targetCurrencyId ?? "__none"}
              onValueChange={(value) =>
                updateMoneyRequest(
                  "targetCurrencyId",
                  value === "__none" ? null : value,
                )
              }
            >
              <SelectTrigger
                className="w-full"
                data-testid="deal-target-currency-select"
              >
                <SelectValue placeholder="Выберите валюту">
                  {targetCurrencyLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Не выбрано</SelectItem>
                {currencyOptions.map((currency) => (
                  <SelectItem key={currency.id} value={currency.id}>
                    {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div
          className={
            shouldInlineMoneyRequestFields
              ? "col-span-full space-y-2"
              : "space-y-2"
          }
        >
          <Label>{sourceCurrencyTitle}</Label>
          <Select
            disabled={readOnly}
            value={intake.moneyRequest.sourceCurrencyId ?? "__none"}
            onValueChange={(value) =>
              updateMoneyRequest(
                "sourceCurrencyId",
                value === "__none" ? null : value,
              )
            }
          >
            <SelectTrigger
              className="w-full"
              data-testid="deal-source-currency-select"
            >
              <SelectValue placeholder="Выберите валюту">
                {sourceCurrencyLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Не выбрано</SelectItem>
              {currencyOptions.map((currency) => (
                <SelectItem key={currency.id} value={currency.id}>
                  {currency.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="deal-purpose">Назначение</Label>
        <Textarea
          id="deal-purpose"
          data-testid="deal-purpose-input"
          disabled={readOnly}
          rows={3}
          value={snapshotFieldValue(intake.moneyRequest.purpose)}
          onChange={(event) =>
            updateMoneyRequest("purpose", event.target.value || null)
          }
        />
      </div>
    </section>
  );
}

export function DealIntakeIncomingReceiptSection({
  context,
}: DealIntakeSectionProps) {
  const {
    applicantSnapshot,
    currencyOptions,
    expectedAmountLabel,
    expectedDateLabel,
    hasDedicatedIncomingReceiptCurrency,
    hasIncomingReceiptSection,
    incomingReceiptCurrencyTitle,
    incomingReceiptSectionDescription,
    incomingReceiptSectionTitle,
    intake,
    isPaymentDeal,
    readOnly,
    shouldRenderPayerDetails,
    updateIncomingReceipt,
    updateMoneyRequest,
    updatePayerSnapshot,
    targetCurrencyLabel,
  } = context;

  if (!hasIncomingReceiptSection) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-medium">{incomingReceiptSectionTitle}</h3>
        <p className="text-sm text-muted-foreground">
          {incomingReceiptSectionDescription}
        </p>
      </div>
      <div className="grid gap-4">
        {!isPaymentDeal ? (
          <div className="space-y-2">
            <Label htmlFor="deal-expected-amount">{expectedAmountLabel}</Label>
            <Input
              id="deal-expected-amount"
              disabled={readOnly}
              inputMode="decimal"
              value={snapshotFieldValue(intake.incomingReceipt.expectedAmount)}
              onChange={(event) =>
                updateIncomingReceipt(
                  "expectedAmount",
                  event.target.value || null,
                )
              }
            />
          </div>
        ) : null}
        {hasDedicatedIncomingReceiptCurrency ? (
          <div className="space-y-2">
            <Label>{incomingReceiptCurrencyTitle}</Label>
            <Select
              disabled={readOnly}
              value={intake.moneyRequest.targetCurrencyId ?? "__none"}
              onValueChange={(value) =>
                updateMoneyRequest(
                  "targetCurrencyId",
                  value === "__none" ? null : value,
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите валюту">
                  {targetCurrencyLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Не выбрано</SelectItem>
                {currencyOptions.map((currency) => (
                  <SelectItem key={currency.id} value={currency.id}>
                    {currency.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="deal-invoice-number">Номер инвойса</Label>
          <Input
            id="deal-invoice-number"
            data-testid="deal-invoice-number-input"
            disabled={readOnly}
            value={snapshotFieldValue(intake.incomingReceipt.invoiceNumber)}
            onChange={(event) =>
              updateIncomingReceipt("invoiceNumber", event.target.value || null)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deal-contract-number">Номер контракта</Label>
          <Input
            id="deal-contract-number"
            data-testid="deal-contract-number-input"
            disabled={readOnly}
            value={snapshotFieldValue(intake.incomingReceipt.contractNumber)}
            onChange={(event) =>
              updateIncomingReceipt(
                "contractNumber",
                event.target.value || null,
              )
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deal-expected-date">{expectedDateLabel}</Label>
          <DatePicker
            id="deal-expected-date"
            disabled={readOnly}
            className="w-full"
            value={toDatePickerValue(intake.incomingReceipt.expectedAt)}
            onChange={(date) =>
              updateIncomingReceipt("expectedAt", toDateStorageValue(date))
            }
          />
        </div>
      </div>
      {shouldRenderPayerDetails ? (
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="deal-payer-display-name">Плательщик</Label>
            <Input
              id="deal-payer-display-name"
              disabled={readOnly}
              value={snapshotFieldValue(applicantSnapshot.displayName)}
              onChange={(event) =>
                updatePayerSnapshot("displayName", event.target.value || null)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deal-payer-legal-name">Полное наименование</Label>
            <Input
              id="deal-payer-legal-name"
              disabled={readOnly}
              value={snapshotFieldValue(applicantSnapshot.legalName)}
              onChange={(event) =>
                updatePayerSnapshot("legalName", event.target.value || null)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deal-payer-inn">ИНН / рег. номер</Label>
            <Input
              id="deal-payer-inn"
              disabled={readOnly}
              value={snapshotFieldValue(applicantSnapshot.inn)}
              onChange={(event) =>
                updatePayerSnapshot("inn", event.target.value || null)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deal-payer-country">Страна</Label>
            <Input
              id="deal-payer-country"
              disabled={readOnly}
              value={snapshotFieldValue(applicantSnapshot.country)}
              onChange={(event) =>
                updatePayerSnapshot("country", event.target.value || null)
              }
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function DealIntakeExternalBeneficiarySection({
  context,
}: DealIntakeSectionProps) {
  const {
    beneficiaryBank,
    beneficiarySnapshot,
    hasExternalBeneficiarySection,
    readOnly,
    updateBeneficiaryBank,
    updateBeneficiarySnapshot,
  } = context;

  if (!hasExternalBeneficiarySection) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="deal-beneficiary-display-name">Получатель</Label>
          <Input
            id="deal-beneficiary-display-name"
            data-testid="deal-beneficiary-display-name-input"
            disabled={readOnly}
            value={snapshotFieldValue(beneficiarySnapshot.displayName)}
            onChange={(event) =>
              updateBeneficiarySnapshot(
                "displayName",
                event.target.value || null,
              )
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deal-beneficiary-legal-name">
            Полное наименование
          </Label>
          <Input
            id="deal-beneficiary-legal-name"
            data-testid="deal-beneficiary-legal-name-input"
            disabled={readOnly}
            value={snapshotFieldValue(beneficiarySnapshot.legalName)}
            onChange={(event) =>
              updateBeneficiarySnapshot("legalName", event.target.value || null)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deal-beneficiary-inn">ИНН / рег. номер</Label>
          <Input
            id="deal-beneficiary-inn"
            data-testid="deal-beneficiary-inn-input"
            disabled={readOnly}
            value={snapshotFieldValue(beneficiarySnapshot.inn)}
            onChange={(event) =>
              updateBeneficiarySnapshot("inn", event.target.value || null)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deal-beneficiary-country">Страна</Label>
          <CountrySelect
            id="deal-beneficiary-country"
            triggerTestId="deal-beneficiary-country-input"
            value={snapshotFieldValue(beneficiarySnapshot.country)}
            onValueChange={(nextValue) =>
              updateBeneficiarySnapshot("country", nextValue || null)
            }
            disabled={readOnly}
            placeholder="Не выбрано"
            searchPlaceholder="Поиск страны..."
            emptyLabel="Страна не найдена"
            clearable
            clearLabel="Очистить"
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="deal-beneficiary-bank-name">Банк получателя</Label>
          <Input
            id="deal-beneficiary-bank-name"
            data-testid="deal-beneficiary-bank-name-input"
            disabled={readOnly}
            value={snapshotFieldValue(beneficiaryBank.bankName)}
            onChange={(event) =>
              updateBeneficiaryBank("bankName", event.target.value || null)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deal-beneficiary-bank-country">Страна банка</Label>
          <Input
            id="deal-beneficiary-bank-country"
            data-testid="deal-beneficiary-bank-country-input"
            disabled={readOnly}
            value={snapshotFieldValue(beneficiaryBank.bankCountry)}
            onChange={(event) =>
              updateBeneficiaryBank("bankCountry", event.target.value || null)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deal-beneficiary-account">Счет</Label>
          <Input
            id="deal-beneficiary-account"
            data-testid="deal-beneficiary-account-input"
            disabled={readOnly}
            value={snapshotFieldValue(beneficiaryBank.accountNo)}
            onChange={(event) =>
              updateBeneficiaryBank("accountNo", event.target.value || null)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deal-beneficiary-iban">IBAN</Label>
          <Input
            id="deal-beneficiary-iban"
            data-testid="deal-beneficiary-iban-input"
            disabled={readOnly}
            value={snapshotFieldValue(beneficiaryBank.iban)}
            onChange={(event) =>
              updateBeneficiaryBank("iban", event.target.value || null)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deal-beneficiary-bic">BIC</Label>
          <Input
            id="deal-beneficiary-bic"
            data-testid="deal-beneficiary-bic-input"
            disabled={readOnly}
            value={snapshotFieldValue(beneficiaryBank.bic)}
            onChange={(event) =>
              updateBeneficiaryBank("bic", event.target.value || null)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deal-beneficiary-swift">SWIFT</Label>
          <Input
            id="deal-beneficiary-swift"
            data-testid="deal-beneficiary-swift-input"
            disabled={readOnly}
            value={snapshotFieldValue(beneficiaryBank.swift)}
            onChange={(event) =>
              updateBeneficiaryBank("swift", event.target.value || null)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deal-beneficiary-name">Имя получателя в банке</Label>
          <Input
            id="deal-beneficiary-name"
            data-testid="deal-beneficiary-name-input"
            disabled={readOnly}
            value={snapshotFieldValue(beneficiaryBank.beneficiaryName)}
            onChange={(event) =>
              updateBeneficiaryBank(
                "beneficiaryName",
                event.target.value || null,
              )
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deal-beneficiary-label">Метка реквизитов</Label>
          <Input
            id="deal-beneficiary-label"
            data-testid="deal-beneficiary-label-input"
            disabled={readOnly}
            value={snapshotFieldValue(beneficiaryBank.label)}
            onChange={(event) =>
              updateBeneficiaryBank("label", event.target.value || null)
            }
          />
        </div>
      </div>
    </section>
  );
}

export function DealIntakeSettlementDestinationSection({
  context,
}: DealIntakeSectionProps) {
  const {
    applicantRequisites,
    applicantRequisiteLabel,
    hasSettlementDestinationSection,
    intake,
    readOnly,
    settlementBank,
    settlementModeLabel,
    update,
    updateSettlementBank,
  } = context;

  if (!hasSettlementDestinationSection) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-medium">Куда зачислить средства</h3>
        <p className="text-sm text-muted-foreground">
          Выберите, куда отправить деньги после сделки: на реквизиты заявителя
          или на отдельные реквизиты.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Режим зачисления</Label>
        <Select
          disabled={readOnly}
          value={intake.settlementDestination.mode ?? "__none"}
          onValueChange={(value) =>
            update({
              settlementDestination: {
                ...intake.settlementDestination,
                mode:
                  value === "__none"
                    ? null
                    : (value as "applicant_requisite" | "manual"),
                requisiteId:
                  value === "applicant_requisite"
                    ? intake.settlementDestination.requisiteId
                    : null,
              },
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Выберите режим">
              {settlementModeLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Не выбрано</SelectItem>
            <SelectItem value="applicant_requisite">
              Реквизиты заявителя
            </SelectItem>
            <SelectItem value="manual">Ручные реквизиты</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {intake.settlementDestination.mode === "applicant_requisite" ? (
        <div className="space-y-2">
          <Label>Реквизиты заявителя</Label>
          <Select
            disabled={readOnly}
            value={intake.settlementDestination.requisiteId ?? "__none"}
            onValueChange={(value) =>
              update({
                settlementDestination: {
                  ...intake.settlementDestination,
                  requisiteId: value === "__none" ? null : value,
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите реквизиты">
                {applicantRequisiteLabel}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Не выбрано</SelectItem>
              {applicantRequisites.map((requisite) => (
                <SelectItem key={requisite.id} value={requisite.id}>
                  {requisite.label}
                  {requisite.providerLabel
                    ? ` · ${requisite.providerLabel}`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {intake.settlementDestination.mode === "manual" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="deal-settlement-bank-name">Банк</Label>
            <Input
              id="deal-settlement-bank-name"
              disabled={readOnly}
              value={snapshotFieldValue(settlementBank.bankName)}
              onChange={(event) =>
                updateSettlementBank("bankName", event.target.value || null)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deal-settlement-bank-country">Страна банка</Label>
            <Input
              id="deal-settlement-bank-country"
              disabled={readOnly}
              value={snapshotFieldValue(settlementBank.bankCountry)}
              onChange={(event) =>
                updateSettlementBank("bankCountry", event.target.value || null)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deal-settlement-account">Счет</Label>
            <Input
              id="deal-settlement-account"
              disabled={readOnly}
              value={snapshotFieldValue(settlementBank.accountNo)}
              onChange={(event) =>
                updateSettlementBank("accountNo", event.target.value || null)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deal-settlement-iban">IBAN</Label>
            <Input
              id="deal-settlement-iban"
              disabled={readOnly}
              value={snapshotFieldValue(settlementBank.iban)}
              onChange={(event) =>
                updateSettlementBank("iban", event.target.value || null)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deal-settlement-bic">BIC</Label>
            <Input
              id="deal-settlement-bic"
              disabled={readOnly}
              value={snapshotFieldValue(settlementBank.bic)}
              onChange={(event) =>
                updateSettlementBank("bic", event.target.value || null)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deal-settlement-swift">SWIFT</Label>
            <Input
              id="deal-settlement-swift"
              disabled={readOnly}
              value={snapshotFieldValue(settlementBank.swift)}
              onChange={(event) =>
                updateSettlementBank("swift", event.target.value || null)
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deal-settlement-beneficiary">
              Получатель в банке
            </Label>
            <Input
              id="deal-settlement-beneficiary"
              disabled={readOnly}
              value={snapshotFieldValue(settlementBank.beneficiaryName)}
              onChange={(event) =>
                updateSettlementBank(
                  "beneficiaryName",
                  event.target.value || null,
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deal-settlement-label">Метка реквизитов</Label>
            <Input
              id="deal-settlement-label"
              disabled={readOnly}
              value={snapshotFieldValue(settlementBank.label)}
              onChange={(event) =>
                updateSettlementBank("label", event.target.value || null)
              }
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function DealIntakeForm(props: DealIntakeFormProps) {
  const context = createDealIntakeFormContext(props);

  return (
    <div className="space-y-6">
      <DealIntakeCommonSection context={context} />
      <DealIntakeMoneyRequestSection context={context} />
      <DealIntakeIncomingReceiptSection context={context} />
      <DealIntakeExternalBeneficiarySection context={context} />
      <DealIntakeSettlementDestinationSection context={context} />
    </div>
  );
}
