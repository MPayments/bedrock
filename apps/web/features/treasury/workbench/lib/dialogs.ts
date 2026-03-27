import { minorToAmountString, toMinorAmountString } from "@bedrock/shared/money";

import { formatMajorAmount } from "@/lib/format";

import { getTreasuryAccountDisplayLabel } from "./display";
import { getTreasuryFlowDescriptor } from "./flows";
import {
  EXECUTION_EVENT_KIND_OPTIONS,
  TREASURY_EVENT_KIND_LABELS,
  TREASURY_INSTRUCTION_STATUS_LABELS,
} from "./labels";
import { formatMoneyValue } from "./presentation";
import type {
  CounterpartyEndpointListItem,
  TreasuryAccountListItem,
  TreasuryEndpointListItem,
  TreasuryOperationTimeline,
} from "./queries";

export type TreasuryDialogFact = {
  label: string;
  value: string;
};

export type TreasuryDialogHint = {
  title: string;
  description: string;
  tone?: "default" | "warning";
};

export type TreasuryInstructionEndpointOption = {
  id: string;
  kind: "counterparty" | "treasury";
  label: string;
  description: string;
};

export type TreasuryExecutionEventDescriptor = {
  kind: (typeof EXECUTION_EVENT_KIND_OPTIONS)[number];
  label: string;
  description: string;
  outcome: string;
};

const TREASURY_EXECUTION_EVENT_DESCRIPTORS: Record<
  (typeof EXECUTION_EVENT_KIND_OPTIONS)[number],
  TreasuryExecutionEventDescriptor
> = {
  submitted: {
    kind: "submitted",
    label: TREASURY_EVENT_KIND_LABELS.submitted ?? "Отправлено",
    description:
      "Инструкция вышла во внешний контур и теперь ожидает результата исполнения.",
    outcome:
      "Операция переходит в активное исполнение. Следующий финальный статус нужно зафиксировать отдельно.",
  },
  accepted: {
    kind: "accepted",
    label: TREASURY_EVENT_KIND_LABELS.accepted ?? "Принято",
    description:
      "Внешний контур подтвердил прием инструкции, но деньги еще не дошли до результата.",
    outcome:
      "Это промежуточный факт. После него обычно нужен итог: исполнено, возврат, ошибка или аннулирование.",
  },
  settled: {
    kind: "settled",
    label: TREASURY_EVENT_KIND_LABELS.settled ?? "Исполнено",
    description:
      "Деньги фактически прошли. Если после этого откроются позиции, их нужно будет закрыть отдельно.",
    outcome:
      "Операция считается исполненной по деньгам. Внутренние позиции и обязательства могут остаться открытыми.",
  },
  failed: {
    kind: "failed",
    label: TREASURY_EVENT_KIND_LABELS.failed ?? "Ошибка",
    description:
      "Исполнение сорвалось и деньги до результата не дошли.",
    outcome:
      "Разберите причину ошибки перед повторной отправкой или новым сценарием.",
  },
  returned: {
    kind: "returned",
    label: TREASURY_EVENT_KIND_LABELS.returned ?? "Возврат",
    description:
      "Деньги вернулись после попытки исполнения или входящее движение было откатано.",
    outcome:
      "После возврата нужно разобрать причину и решить, нужен ли новый маршрут денег.",
  },
  voided: {
    kind: "voided",
    label: TREASURY_EVENT_KIND_LABELS.voided ?? "Аннулировано",
    description:
      "Инструкция аннулирована и больше не должна двигаться дальше.",
    outcome:
      "Сценарий закрыт без дальнейшего исполнения. Новая попытка оформляется отдельно.",
  },
  fee_charged: {
    kind: "fee_charged",
    label: TREASURY_EVENT_KIND_LABELS.fee_charged ?? "Комиссия списана",
    description:
      "Внешний контур отдельно сообщил о комиссии по уже существующему движению.",
    outcome:
      "Это вспомогательный факт. Используйте его только когда нужно явно зафиксировать комиссию.",
  },
  manual_adjustment: {
    kind: "manual_adjustment",
    label:
      TREASURY_EVENT_KIND_LABELS.manual_adjustment ?? "Ручная корректировка",
    description:
      "Ручная корректировка событий исполнения для нестандартной ситуации.",
    outcome:
      "Используйте только когда обычные события не описывают фактическое состояние.",
  },
};

function buildAccountLabelMap(
  accounts: TreasuryAccountListItem[],
  assetLabels: Record<string, string>,
) {
  return Object.fromEntries(
    accounts.map((account) => {
      const assetCode = assetLabels[account.assetId] ?? account.assetId;
      return [
        account.id,
        `${getTreasuryAccountDisplayLabel(account)} · ${assetCode}`,
      ];
    }),
  );
}

export function formatTreasuryAmountInputValue(
  amountMinor: string | null | undefined,
  assetCode: string | null | undefined,
) {
  if (!amountMinor) {
    return "";
  }

  return minorToAmountString(amountMinor, {
    currency: assetCode ?? undefined,
  });
}

export function parseTreasuryAmountInput(input: {
  assetCode: string | null | undefined;
  amountMajor: string;
}) {
  return toMinorAmountString(input.amountMajor, input.assetCode ?? null, {
    requirePositive: true,
  });
}

export function resolveTreasuryAmountValidationMessage(message: string) {
  if (message === "amount must be positive") {
    return "Введите корректную положительную сумму";
  }

  if (message === "amount must be a number, e.g. 1000.50") {
    return "Введите сумму в формате 1000,50";
  }

  if (message.startsWith("amount has too many fraction digits")) {
    return "Слишком много знаков после запятой для выбранной валюты";
  }

  return message;
}

export function buildExecutionInstructionDialogModel(input: {
  accounts: TreasuryAccountListItem[];
  assetLabels: Record<string, string>;
  counterpartyEndpoints: CounterpartyEndpointListItem[];
  counterpartyLabels: Record<string, string>;
  operationTimeline: TreasuryOperationTimeline;
  treasuryEndpoints: TreasuryEndpointListItem[];
}) {
  const operation = input.operationTimeline.operation;
  const accountLabels = buildAccountLabelMap(input.accounts, input.assetLabels);
  const flowDescriptor = getTreasuryFlowDescriptor(
    operation.operationKind === "fx_conversion"
      ? "fx_execute"
      : operation.operationKind,
  );
  const assetCode =
    input.assetLabels[operation.sourceAssetId ?? ""] ??
    operation.sourceAssetId ??
    null;
  const sourceAccountLabel = operation.sourceAccountId
    ? accountLabels[operation.sourceAccountId] ?? operation.sourceAccountId
    : "—";
  const accountsById = new Map(
    input.accounts.map((account) => [account.id, account]),
  );

  const endpointOptions: TreasuryInstructionEndpointOption[] = [];

  for (const endpoint of input.counterpartyEndpoints) {
    if (operation.sourceAssetId && endpoint.assetId !== operation.sourceAssetId) {
      continue;
    }

    const counterpartyLabel =
      input.counterpartyLabels[endpoint.counterpartyId] ?? endpoint.counterpartyId;

    endpointOptions.push({
      id: endpoint.id,
      kind: "counterparty",
      label: endpoint.label ?? endpoint.value,
      description: `Контрагент · ${counterpartyLabel} · ${endpoint.endpointType}`,
    });
  }

  for (const endpoint of input.treasuryEndpoints) {
    const endpointAccount = accountsById.get(endpoint.accountId);
    if (
      operation.sourceAssetId &&
      endpointAccount &&
      endpointAccount.assetId !== operation.sourceAssetId
    ) {
      continue;
    }

    endpointOptions.push({
      id: endpoint.id,
      kind: "treasury",
      label:
        endpoint.label ??
        `${accountLabels[endpoint.accountId] ?? endpoint.accountId} · ${endpoint.value}`,
      description: `Treasury endpoint · ${endpoint.endpointType}`,
    });
  }

  let endpointHint: TreasuryDialogHint;
  switch (operation.operationKind) {
    case "collection":
      endpointHint = {
        title: "Реквизиты назначения можно не указывать",
        description:
          "Для поступления достаточно суммы и инструкции. Внешнюю запись можно привязать позже через событие исполнения и исключения.",
      };
      break;
    case "intracompany_transfer":
    case "intercompany_funding":
    case "sweep":
      endpointHint = {
        title: "Выберите внутренний treasury endpoint",
        description:
          "Для внутренних движений инструкция обычно должна указывать точку зачисления на стороне целевого счета.",
      };
      break;
    default:
      endpointHint = {
        title: "Выберите маршрут исполнения",
        description:
          "Для выплаты и возврата обычно нужны внешние реквизиты получателя. Без них оператор не увидит, куда именно уходит инструкция.",
      };
      break;
  }

  if (endpointOptions.length === 0) {
    endpointHint = {
      title: "Подходящих реквизитов пока нет",
      description:
        "Сначала создайте treasury endpoint или реквизит контрагента в той же валюте, что и операция.",
      tone: "warning",
    };
  }

  return {
    amountMajor: formatTreasuryAmountInputValue(
      operation.sourceAmountMinor,
      assetCode,
    ),
    amountLabel: formatMoneyValue(operation.sourceAmountMinor, assetCode),
    assetCode,
    endpointHint,
    endpointOptions,
    facts: [
      {
        label: "Сценарий",
        value: flowDescriptor.title,
      },
      {
        label: flowDescriptor.sourceLabel,
        value: sourceAccountLabel,
      },
      {
        label: "Сумма операции",
        value: formatMoneyValue(operation.sourceAmountMinor, assetCode),
      },
      {
        label: "Следующий шаг",
        value: "После создания инструкции фиксируйте фактическое событие исполнения.",
      },
    ] satisfies TreasuryDialogFact[],
    nextStepHint: {
      title: "Что появится после сохранения",
      description:
        "Инструкция станет конкретным маршрутом исполнения. Именно по ней дальше фиксируются события: отправлено, исполнено, возврат, ошибка.",
    } satisfies TreasuryDialogHint,
    routeRule: flowDescriptor.destinationRule,
  };
}

export function buildExecutionEventDescriptors() {
  return EXECUTION_EVENT_KIND_OPTIONS.map(
    (kind) => TREASURY_EXECUTION_EVENT_DESCRIPTORS[kind],
  );
}

export function buildPositionSettlementDialogModel(input: {
  amountMinor: string;
  assetCode: string | null;
  kindLabel: string;
  meaning: string;
  ownerLabel: string;
  relatedPartyLabel: string;
}) {
  return {
    amountMajor: formatTreasuryAmountInputValue(input.amountMinor, input.assetCode),
    facts: [
      { label: "Тип позиции", value: input.kindLabel },
      { label: "Владелец", value: input.ownerLabel },
      { label: "Кому относится", value: input.relatedPartyLabel },
      {
        label: "Остаток к погашению",
        value: formatMoneyValue(input.amountMinor, input.assetCode),
      },
    ] satisfies TreasuryDialogFact[],
    explanation: {
      title: "Что делает погашение позиции",
      description:
        "Погашение закрывает внутренний остаток после фактического движения денег. Это не новый платеж, а завершение внутреннего расчета.",
    } satisfies TreasuryDialogHint,
    meaning: input.meaning,
  };
}

export function buildInstructionSelectOption(input: {
  amountMinor: string;
  assetCode: string | null;
  id: string;
  routeLabel?: string | null;
  scenarioLabel?: string | null;
  status: string;
}) {
  return {
    id: input.id,
    label:
      input.scenarioLabel ??
      `${formatMoneyValue(input.amountMinor, input.assetCode)} · #${input.id.slice(0, 8)}`,
    description: [
      input.routeLabel,
      TREASURY_INSTRUCTION_STATUS_LABELS[input.status] ?? input.status,
      formatMoneyValue(input.amountMinor, input.assetCode),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export function buildMatchExternalRecordFacts(input: {
  externalRecordId: string;
  reasonCode: string;
  recordKind: string | null;
  source: string;
}) {
  return [
    { label: "Источник", value: input.source },
    { label: "Тип записи", value: input.recordKind ?? "Не указан" },
    { label: "Почему это исключение", value: input.reasonCode },
    { label: "Внешняя запись", value: input.externalRecordId.slice(0, 8) },
  ] satisfies TreasuryDialogFact[];
}

export function formatPreviewMajorAmount(input: string) {
  const normalized = input.trim();
  if (!normalized) {
    return null;
  }

  return formatMajorAmount(normalized.replace(",", "."));
}
