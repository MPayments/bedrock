"use client";

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
    expectedCurrencyId: string | null;
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
  corrAccount: string | null;
  iban: string | null;
  label: string | null;
  swift: string | null;
};

export type CrmCustomerLegalEntityOption = {
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

type DealIntakeFormProps = {
  applicantRequisites: CrmApplicantRequisiteOption[];
  currencyOptions: CrmCurrencyOption[];
  intake: CrmDealIntakeDraft;
  legalEntities: CrmCustomerLegalEntityOption[];
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
    corrAccount: null,
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
      expectedCurrencyId: null,
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

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function toDateStorageValue(value: string) {
  return value ? `${value}T00:00:00.000Z` : null;
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

export function DealIntakeForm({
  applicantRequisites,
  currencyOptions,
  intake,
  legalEntities,
  moneyRequestLayout = "stacked",
  onChange,
  readOnly = false,
}: DealIntakeFormProps) {
  const applicantSnapshot =
    intake.incomingReceipt.payerSnapshot ?? emptyCounterpartySnapshot();
  const beneficiarySnapshot =
    intake.externalBeneficiary.beneficiarySnapshot ?? emptyCounterpartySnapshot();
  const beneficiaryBank =
    intake.externalBeneficiary.bankInstructionSnapshot ??
    emptyBankInstructionSnapshot();
  const settlementBank =
    intake.settlementDestination.bankInstructionSnapshot ??
    emptyBankInstructionSnapshot();
  const selectedApplicant =
    legalEntities.find(
      (legalEntity) =>
        legalEntity.counterpartyId === intake.common.applicantCounterpartyId,
    ) ?? null;
  const selectedSourceCurrency =
    currencyOptions.find(
      (currency) => currency.id === intake.moneyRequest.sourceCurrencyId,
    ) ?? null;
  const selectedTargetCurrency =
    currencyOptions.find(
      (currency) => currency.id === intake.moneyRequest.targetCurrencyId,
    ) ?? null;
  const selectedExpectedCurrency =
    currencyOptions.find(
      (currency) => currency.id === intake.incomingReceipt.expectedCurrencyId,
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
  const primaryAmountLabel = isPaymentDeal ? "Сумма оплаты" : "Сумма";
  const sourceCurrencyTitle = isPaymentDeal
    ? "Валюта списания"
    : "Валюта списания";
  const targetCurrencyTitle = isPaymentDeal
    ? "Валюта оплаты"
    : "Целевая валюта";
  const sourceAmountLabel = isPaymentDeal
    ? "Сумма списания, если согласована"
    : "Сумма списания";
  const incomingReceiptSectionTitle = isPaymentDeal
    ? "Инвойс поставщика"
    : "Входящее поступление";
  const incomingReceiptSectionDescription = isPaymentDeal
    ? "Данные из инвойса поставщика: сумма, номер и договор. Их можно заполнить вручную или подтянуть из OCR."
    : "Данные о платеже, который ожидается от покупателя или плательщика.";
  const expectedAmountLabel = isPaymentDeal
    ? "Сумма инвойса"
    : "Ожидаемая сумма";
  const expectedCurrencyTitle = isPaymentDeal
    ? "Валюта инвойса"
    : "Валюта поступления";
  const expectedDateLabel = isPaymentDeal
    ? "Плановая дата выплаты"
    : "Ожидаемая дата поступления";
  const shouldRenderPayerDetails = shouldRenderIncomingReceiptPayer(intake.type);
  const primaryAmountValue = isPaymentDeal
    ? snapshotFieldValue(intake.incomingReceipt.expectedAmount)
    : snapshotFieldValue(intake.moneyRequest.sourceAmount);
  const selectedApplicantLabel = resolveOptionLabel({
    emptyLabel: "Не выбрано",
    loadingLabel: "Загрузка юридических лиц...",
    matchedLabel: selectedApplicant
      ? `${selectedApplicant.shortName}${
          selectedApplicant.inn ? ` · ИНН ${selectedApplicant.inn}` : ""
        }`
      : null,
    missingLabel: "Выбранное юрлицо недоступно",
    optionsCount: legalEntities.length,
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
  const expectedCurrencyLabel = resolveOptionLabel({
    emptyLabel: "Не выбрано",
    loadingLabel: "Загрузка валют...",
    matchedLabel: selectedExpectedCurrency?.label ?? null,
    missingLabel: "Выбранная валюта недоступна",
    optionsCount: currencyOptions.length,
    value: intake.incomingReceipt.expectedCurrencyId,
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
    const nextIntake: Partial<CrmDealIntakeDraft> = {
      moneyRequest: {
        ...intake.moneyRequest,
        [key]: value,
      },
    };

    if (intake.type === "payment" && key === "targetCurrencyId") {
      nextIntake.incomingReceipt = {
        ...intake.incomingReceipt,
        expectedCurrencyId: value,
      };
    }

    update(nextIntake);
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

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h3 className="font-medium">Общие данные</h3>
        </div>
        <div className="grid gap-4">
          <div className="min-w-0 max-w-full space-y-2">
            <Label>Юридическое лицо заявителя</Label>
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
                  placeholder="Выберите юридическое лицо"
                >
                  {selectedApplicantLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Не выбрано</SelectItem>
                {legalEntities.map((legalEntity) => (
                  <SelectItem
                    key={legalEntity.counterpartyId}
                    value={legalEntity.counterpartyId}
                  >
                    {legalEntity.shortName}
                    {legalEntity.inn ? ` · ИНН ${legalEntity.inn}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="deal-requested-execution-date">
              Желаемая дата исполнения
            </Label>
            <Input
              id="deal-requested-execution-date"
              disabled={readOnly}
              type="date"
              value={toDateInputValue(intake.common.requestedExecutionDate)}
              onChange={(event) =>
                updateCommon(
                  "requestedExecutionDate",
                  toDateStorageValue(event.target.value),
                )
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
              disabled={readOnly}
              inputMode="decimal"
              value={primaryAmountValue}
              onChange={(event) => updatePrimaryAmount(event.target.value || null)}
            />
          </div>
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
              <SelectTrigger className="w-full">
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
          <div
            className={
              shouldInlineMoneyRequestFields ? "col-span-full space-y-2" : "space-y-2"
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
              <SelectTrigger className="w-full">
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
        {isPaymentDeal ? (
          <div className="space-y-2">
            <Label htmlFor="deal-source-amount">{sourceAmountLabel}</Label>
            <Input
              id="deal-source-amount"
              disabled={readOnly}
              inputMode="decimal"
              value={snapshotFieldValue(intake.moneyRequest.sourceAmount)}
              onChange={(event) =>
                updateMoneyRequest("sourceAmount", event.target.value || null)
              }
            />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="deal-purpose">Назначение</Label>
          <Textarea
            id="deal-purpose"
            disabled={readOnly}
            rows={3}
            value={snapshotFieldValue(intake.moneyRequest.purpose)}
            onChange={(event) =>
              updateMoneyRequest("purpose", event.target.value || null)
            }
          />
        </div>
      </section>

      {shouldRenderIncomingReceipt(intake.type) ? (
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
            {!isPaymentDeal ? (
              <div className="space-y-2">
                <Label>{expectedCurrencyTitle}</Label>
                <Select
                  disabled={readOnly}
                  value={intake.incomingReceipt.expectedCurrencyId ?? "__none"}
                  onValueChange={(value) =>
                    updateIncomingReceipt(
                      "expectedCurrencyId",
                      value === "__none" ? null : value,
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите валюту">
                      {expectedCurrencyLabel}
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
              <Input
                id="deal-expected-date"
                disabled={readOnly}
                type="date"
                value={toDateInputValue(intake.incomingReceipt.expectedAt)}
                onChange={(event) =>
                  updateIncomingReceipt(
                    "expectedAt",
                    toDateStorageValue(event.target.value),
                  )
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
      ) : null}

      {shouldRenderExternalBeneficiary(intake.type) ? (
        <section className="space-y-4">
          <div>
            <h3 className="font-medium">Получатель выплаты</h3>
            <p className="text-sm text-muted-foreground">
              Кому и по каким банковским реквизитам отправляем выплату.
            </p>
          </div>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="deal-beneficiary-display-name">Получатель</Label>
              <Input
                id="deal-beneficiary-display-name"
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
              <Label htmlFor="deal-beneficiary-legal-name">Полное наименование</Label>
              <Input
                id="deal-beneficiary-legal-name"
                disabled={readOnly}
                value={snapshotFieldValue(beneficiarySnapshot.legalName)}
                onChange={(event) =>
                  updateBeneficiarySnapshot(
                    "legalName",
                    event.target.value || null,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-beneficiary-inn">ИНН / рег. номер</Label>
              <Input
                id="deal-beneficiary-inn"
                disabled={readOnly}
                value={snapshotFieldValue(beneficiarySnapshot.inn)}
                onChange={(event) =>
                  updateBeneficiarySnapshot("inn", event.target.value || null)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-beneficiary-country">Страна</Label>
              <Input
                id="deal-beneficiary-country"
                disabled={readOnly}
                value={snapshotFieldValue(beneficiarySnapshot.country)}
                onChange={(event) =>
                  updateBeneficiarySnapshot("country", event.target.value || null)
                }
              />
            </div>
          </div>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="deal-beneficiary-bank-name">Банк получателя</Label>
              <Input
                id="deal-beneficiary-bank-name"
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
                disabled={readOnly}
                value={snapshotFieldValue(beneficiaryBank.bankCountry)}
                onChange={(event) =>
                  updateBeneficiaryBank(
                    "bankCountry",
                    event.target.value || null,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-beneficiary-account">Счет</Label>
              <Input
                id="deal-beneficiary-account"
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
                disabled={readOnly}
                value={snapshotFieldValue(beneficiaryBank.label)}
                onChange={(event) =>
                  updateBeneficiaryBank("label", event.target.value || null)
                }
              />
            </div>
          </div>
        </section>
      ) : null}

      {shouldRenderSettlementDestination(intake.type) ? (
        <section className="space-y-4">
          <div>
            <h3 className="font-medium">Куда зачислить средства</h3>
            <p className="text-sm text-muted-foreground">
              Выберите, куда отправить деньги после сделки: на реквизиты
              заявителя или на отдельные реквизиты.
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
            <div className="grid gap-4">
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
                    updateSettlementBank(
                      "bankCountry",
                      event.target.value || null,
                    )
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
      ) : null}
    </div>
  );
}
