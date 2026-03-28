import type {
  CounterpartyEndpointListItem,
  TreasuryAccountListItem,
  TreasuryOperationArtifact,
  TreasuryOperationListItem,
  TreasuryOperationTimeline,
} from "./queries";

export type TreasuryOperationFlowKind =
  | "collection"
  | "payout"
  | "intracompany_transfer"
  | "intercompany_funding"
  | "sweep"
  | "return"
  | "adjustment";

export type TreasuryFlowId = TreasuryOperationFlowKind | "fx_execute";

export type TreasuryFlowDescriptor = {
  id: TreasuryFlowId;
  title: string;
  shortDescription: string;
  longDescription: string;
  sourceLabel: string;
  destinationLabel: string;
  sourceRule: string;
  destinationRule: string;
  amountRule: string;
  requiredInputs: string[];
  nextStepHint: string;
  emptyStateText: string;
  exceptionHint: string;
  destinationAccountMode:
    | "none"
    | "same_entity_same_asset"
    | "cross_entity_same_asset";
};

export type OperationStageSummary = {
  title: string;
  description: string;
};

export const TREASURY_FLOW_DESCRIPTORS: Record<
  TreasuryFlowId,
  TreasuryFlowDescriptor
> = {
  payout: {
    id: "payout",
    title: "Выплата",
    shortDescription: "Исходящий платеж внешнему получателю.",
    longDescription:
      "Используйте для ручного исходящего платежа, когда деньги уходят внешнему контрагенту с казначейского счета.",
    sourceLabel: "Счет списания",
    destinationLabel: "Реквизиты получателя",
    sourceRule:
      "Источник — казначейский счет, с которого реально списываются деньги.",
    destinationRule:
      "Счет назначения внутри казначейства не нужен. После создания оформляется инструкция с внешними реквизитами получателя.",
    amountRule: "Сумма задается в валюте счета списания, без смены актива.",
    requiredInputs: ["Счет списания", "Сумма", "Комментарий при необходимости"],
    nextStepHint:
      "После создания выплату нужно одобрить, зарезервировать и оформить инструкцию на исполнение.",
    emptyStateText:
      "Когда появятся выплаты, здесь будет видно, кто платит, с какого счета и на каком этапе исполнения находится операция.",
    exceptionHint:
      "Если платеж вернулся или не исполнился, разбирать его нужно через события исполнения и исключения сверки.",
    destinationAccountMode: "none",
  },
  collection: {
    id: "collection",
    title: "Поступление",
    shortDescription: "Входящее поступление на казначейский счет.",
    longDescription:
      "Используйте для ручного учета ожидаемого поступления денег на казначейский счет, когда нужно затем зафиксировать фактическое зачисление.",
    sourceLabel: "Счет зачисления",
    destinationLabel: "Внешний источник поступления",
    sourceRule:
      "Источник — казначейский счет, на который ожидается фактическое зачисление.",
    destinationRule:
      "Внутренний счет назначения не выбирается. Детали плательщика и внешней записи фиксируются через инструкцию и событие исполнения.",
    amountRule: "Сумма задается в валюте счета зачисления, без конверсии.",
    requiredInputs: [
      "Счет зачисления",
      "Сумма",
      "Комментарий при необходимости",
    ],
    nextStepHint:
      "После создания поступления создайте инструкцию или дождитесь внешней записи и зафиксируйте событие исполнения.",
    emptyStateText:
      "Здесь появятся ожидаемые поступления, когда их начнут вести через казначейство, а не только через документы и сверку.",
    exceptionHint:
      "Если поступление не удается сопоставить с внешней записью, оно должно попасть в исключения для ручного разбора.",
    destinationAccountMode: "none",
  },
  intracompany_transfer: {
    id: "intracompany_transfer",
    title: "Внутренний перевод",
    shortDescription: "Перевод между своими счетами одной организации.",
    longDescription:
      "Используйте, когда деньги нужно перебросить между казначейскими счетами одной и той же организации без смены валюты.",
    sourceLabel: "Счет списания",
    destinationLabel: "Счет зачисления",
    sourceRule: "Источник и назначение должны принадлежать одной организации.",
    destinationRule:
      "Разрешены только счета той же организации и в той же валюте.",
    amountRule: "Сумма одинакова на стороне списания и зачисления.",
    requiredInputs: ["Счет списания", "Счет зачисления", "Сумма"],
    nextStepHint:
      "После создания перевода пройдите обычный цикл: одобрение, резерв, инструкция, событие исполнения.",
    emptyStateText:
      "Внутренние переводы между своими счетами появятся здесь, когда их создадут из treasury front door.",
    exceptionHint:
      "Если перевод застрял между своими счетами, это будет видно по инструкции, событиям исполнения и открытым позициям.",
    destinationAccountMode: "same_entity_same_asset",
  },
  intercompany_funding: {
    id: "intercompany_funding",
    title: "Внутригрупповое финансирование",
    shortDescription: "Финансирование между компаниями группы.",
    longDescription:
      "Используйте для перевода денег между компаниями группы, когда экономический владелец и исполняющая организация различаются.",
    sourceLabel: "Счет списания",
    destinationLabel: "Счет компании группы",
    sourceRule: "Источник - казначейский счет исполняющей организации.",
    destinationRule:
      "Назначение должно принадлежать другой компании группы, но оставаться в той же валюте.",
    amountRule:
      "Сумма задается в валюте счета списания. Для сценария требуется юридическое основание.",
    requiredInputs: [
      "Счет списания",
      "Счет компании группы",
      "Сумма",
      "Юридическое основание",
    ],
    nextStepHint:
      "После исполнения могут открыться межкомпанейские позиции, которые затем нужно будет отдельно погасить.",
    emptyStateText:
      "Здесь будут внутригрупповые переводы, когда казначейство начнет вести их как отдельный операторский сценарий.",
    exceptionHint:
      "Если деньги дошли, но межкомпанейская позиция осталась открытой, закрывать ее нужно уже на странице позиций.",
    destinationAccountMode: "cross_entity_same_asset",
  },
  sweep: {
    id: "sweep",
    title: "Переброска ликвидности",
    shortDescription: "Концентрация ликвидности между своими казначейскими счетами.",
    longDescription:
      "Используйте для оперативной переброски ликвидности между своими казначейскими счетами без смены владельца и без конверсии.",
    sourceLabel: "Счет списания",
    destinationLabel: "Счет концентрации",
    sourceRule: "Оба счета должны принадлежать одной организации.",
    destinationRule:
      "Разрешены только счета той же организации и в той же валюте.",
    amountRule:
      "Сумма остается в той же валюте и не меняет экономический смысл операции.",
    requiredInputs: ["Счет списания", "Счет концентрации", "Сумма"],
    nextStepHint:
      "После исполнения проверьте, что ликвидность действительно сконцентрирована на нужном счете.",
    emptyStateText:
      "Когда казначейство начнет регулярно выравнивать ликвидность между счетами, такие операции будут группироваться здесь.",
    exceptionHint:
      "Если переброска зависла или вернулась, продолжать нужно через события исполнения, а не новой операцией поверх старой.",
    destinationAccountMode: "same_entity_same_asset",
  },
  return: {
    id: "return",
    title: "Возврат",
    shortDescription:
      "Возврат ранее отправленных или ошибочно полученных денег.",
    longDescription:
      "Используйте, когда нужно оформить отдельную возвратную операцию без валютной конверсии.",
    sourceLabel: "Счет списания",
    destinationLabel: "Реквизиты возврата",
    sourceRule: "Источник - казначейский счет, с которого реально уходит возврат.",
    destinationRule:
      "Внутренний счет назначения не нужен: возврат завершается инструкцией и событиями исполнения.",
    amountRule: "Сумма задается в валюте счета списания, без смены актива.",
    requiredInputs: [
      "Счет списания",
      "Сумма",
      "Комментарий с причиной возврата",
    ],
    nextStepHint:
      "После создания возврат проходит обычный цикл исполнения. Особое внимание — к причине и связанным обязательствам.",
    emptyStateText:
      "Отдельные возвраты будут видны здесь, когда оператор начнет оформлять их через казначейство, а не как свободный комментарий.",
    exceptionHint:
      "Возврат нельзя лечить новой выплатой. Нужно зафиксировать правильные события исполнения и только потом решать, что делать дальше.",
    destinationAccountMode: "none",
  },
  adjustment: {
    id: "adjustment",
    title: "Корректировка",
    shortDescription: "Ручная корректировка движения по казначейскому счету.",
    longDescription:
      "Используйте только для ручной корректировки, когда нужно отразить нестандартное движение без смены валюты и без обычного платежного сценария.",
    sourceLabel: "Корректируемый счет",
    destinationLabel: "Дополнительный маршрут не требуется",
    sourceRule: "Указывается казначейский счет, по которому нужна корректировка.",
    destinationRule: "Счет назначения не используется.",
    amountRule:
      "Сумма задается в валюте счета, к которому относится корректировка.",
    requiredInputs: [
      "Корректируемый счет",
      "Сумма",
      "Обязательный комментарий",
    ],
    nextStepHint:
      "Перед созданием корректировки убедитесь, что это действительно не выплата, не поступление и не возврат.",
    emptyStateText:
      "Корректировки будут собираться здесь отдельно, чтобы их можно было быстро проверять и аудировать.",
    exceptionHint:
      "Если по корректировке возникает внешняя запись или спорная ситуация, ее тоже нужно доводить через события исполнения и исключения.",
    destinationAccountMode: "none",
  },
  fx_execute: {
    id: "fx_execute",
    title: "Казначейский FX",
    shortDescription:
      "Обмен одной валюты на другую с котировкой и финансовыми линиями.",
    longDescription:
      "Используйте для любого обмена валюты. FX ведется отдельным казначейским сценарием с реквизитами источника и назначения, котировкой, курсом и финансовыми линиями.",
    sourceLabel: "Реквизиты списания",
    destinationLabel: "Реквизиты зачисления",
    sourceRule: "Источник и назначение должны быть разными реквизитами.",
    destinationRule:
      "Реквизит назначения должен быть в другой валюте. FX нельзя оформлять через обычную казначейскую операцию.",
    amountRule:
      "Оператор должен понимать исходную валюту, валюту получения, курс, комиссию и финансовые линии до отправки документа.",
    requiredInputs: [
      "Реквизиты списания",
      "Реквизиты зачисления",
      "Курс / котировка",
      "Сумма",
    ],
    nextStepHint:
      "Запускайте FX из treasury front door, затем переходите в FX-документ и контролируйте котировку, курс и исполнение.",
    emptyStateText:
      "FX-конверсии появятся здесь, когда казначейство будет использовать отдельный FX workspace вместо обхода через общие документы.",
    exceptionHint:
      "Если FX нельзя построить из-за отсутствия кросс-курса или некорректных реквизитов, оператор должен увидеть это как ожидаемое состояние, а не как runtime-ошибку.",
    destinationAccountMode: "none",
  },
};

export const NON_FX_FLOW_ORDER: TreasuryOperationFlowKind[] = [
  "payout",
  "collection",
  "intracompany_transfer",
  "intercompany_funding",
  "sweep",
  "return",
  "adjustment",
];

export function getTreasuryFlowDescriptor(id: TreasuryFlowId) {
  return TREASURY_FLOW_DESCRIPTORS[id];
}

export function listNonFxTreasuryFlowDescriptors() {
  return NON_FX_FLOW_ORDER.map((kind) => TREASURY_FLOW_DESCRIPTORS[kind]);
}

export function requiresDestinationAccount(kind: TreasuryOperationFlowKind) {
  return TREASURY_FLOW_DESCRIPTORS[kind].destinationAccountMode !== "none";
}

export function getAllowedDestinationRuleSummary(
  kind: TreasuryOperationFlowKind,
) {
  return TREASURY_FLOW_DESCRIPTORS[kind].destinationRule;
}

export function getAllowedDestinationAccounts(input: {
  accounts: TreasuryAccountListItem[];
  kind: TreasuryOperationFlowKind;
  sourceAccountId: string | null;
  sourceAccount: TreasuryAccountListItem | null;
}) {
  return input.accounts.filter((account) => {
    if (account.id === input.sourceAccountId) {
      return false;
    }

    if (!input.sourceAccount) {
      return true;
    }

    const mode = TREASURY_FLOW_DESCRIPTORS[input.kind].destinationAccountMode;
    if (mode === "none") {
      return false;
    }

    if (mode === "same_entity_same_asset") {
      return (
        account.ownerEntityId === input.sourceAccount.ownerEntityId &&
        account.assetId === input.sourceAccount.assetId
      );
    }

    if (mode === "cross_entity_same_asset") {
      return (
        account.ownerEntityId !== input.sourceAccount.ownerEntityId &&
        account.assetId === input.sourceAccount.assetId
      );
    }

    return false;
  });
}

export function getSourceAccountFieldLabel(kind: TreasuryOperationFlowKind) {
  return TREASURY_FLOW_DESCRIPTORS[kind].sourceLabel;
}

export function buildOperationRouteSummary(input: {
  destinationAccountLabel: string;
  operation: Pick<
    TreasuryOperationListItem,
    "operationKind" | "sourceAccountId" | "sourceAmountMinor"
  > & {
    destinationAccountId: string | null;
  };
  sourceAccountLabel: string;
  sourceAmountLabel: string;
}) {
  switch (input.operation.operationKind) {
    case "payout":
      return `Исходящий платеж ${input.sourceAmountLabel} со счета ${input.sourceAccountLabel} внешнему получателю.`;
    case "collection":
      return `Ожидаем поступление ${input.sourceAmountLabel} на счет ${input.sourceAccountLabel}.`;
    case "intracompany_transfer":
      return `Перевод ${input.sourceAmountLabel} между своими счетами: ${input.sourceAccountLabel} -> ${input.destinationAccountLabel}.`;
    case "intercompany_funding":
      return `Перевод ${input.sourceAmountLabel} между компаниями группы: ${input.sourceAccountLabel} -> ${input.destinationAccountLabel}.`;
    case "sweep":
      return `Переброска ликвидности ${input.sourceAmountLabel}: ${input.sourceAccountLabel} -> ${input.destinationAccountLabel}.`;
    case "return":
      return `Возврат ${input.sourceAmountLabel} со счета ${input.sourceAccountLabel}.`;
    case "adjustment":
      return `Ручная корректировка ${input.sourceAmountLabel} по счету ${input.sourceAccountLabel}.`;
    case "fx_conversion":
      return "Конверсия валюты оформляется через отдельный FX-сценарий с котировкой и финансовыми линиями.";
    default:
      return "Маршрут денег определяется инструкциями и событиями исполнения.";
  }
}

export function buildOperationStageSummary(input: {
  eventCount: number;
  latestEventKind: string | null;
  positionCount: number;
  status: string;
}): OperationStageSummary {
  switch (input.status) {
    case "draft":
      return {
        title: "Ожидает одобрения",
        description:
          "Операция создана, но движение денег еще не разрешено. Сначала подтвердите, что сценарий и маршрут выбраны правильно.",
      };
    case "approved":
      return {
        title: "Ожидает резерва",
        description:
          "Бизнес-решение уже принято. Следующая контрольная точка — резерв денег на исходном счете.",
      };
    case "reserved":
      return {
        title: "Готова к исполнению",
        description:
          input.eventCount > 0
            ? "Средства зарезервированы, и по операции уже начали появляться события исполнения."
            : "Средства зарезервированы. Теперь нужен маршрут исполнения: инструкция и первый фактический статус.",
      };
    case "submitted":
      return {
        title: "В работе у исполнения",
        description:
          input.latestEventKind === "submitted"
            ? "Инструкция отправлена. Теперь оператору нужен итог исполнения: исполнено, ошибка, возврат или аннулирование."
            : "По операции уже есть активное движение. Сверьте фактическое состояние с лентой событий.",
      };
    case "partially_settled":
      return {
        title: "Исполнена частично",
        description:
          "Часть суммы уже прошла, но сценарий еще не закрыт. Нужно понять, чем закрывается остаток.",
      };
    case "settled":
      return {
        title: "Исполнена",
        description:
          input.positionCount > 0
            ? "Деньги по операции прошли, но после исполнения остались внутренние позиции, которые еще нужно разобрать."
            : "Деньги по операции прошли, и явных последующих действий по ней не осталось.",
      };
    case "failed":
      return {
        title: "Завершилась ошибкой",
        description:
          "Исполнение не прошло. Нужно проверить причину и решить, требуется ли повторная отправка или новый сценарий.",
      };
    case "returned":
      return {
        title: "Деньги вернулись",
        description:
          "Исполнение было откатано или не дошло до результата. Дальше нужно разобрать причину возврата.",
      };
    case "void":
      return {
        title: "Аннулирована",
        description:
          "Операция закрыта без дальнейшего исполнения и больше не требует действий.",
      };
    default:
      return {
        title: "Состояние операции",
        description:
          "Проверьте, какой этап уже пройден и какой шаг остается следующим.",
      };
  }
}

export function buildOperationNextStep(input: {
  instructionCount: number;
  positionCount: number;
  status: string;
}) {
  switch (input.status) {
    case "draft":
      return "Одобрите операцию, если сценарий, сумма и маршрут денег верны.";
    case "approved":
      return "Зарезервируйте средства на исходном счете.";
    case "reserved":
      return input.instructionCount > 0
        ? "Инструкция уже создана. Следующий шаг — зафиксировать фактическое событие исполнения."
        : "Создайте инструкцию на исполнение: кому платим, куда ждем деньги или как именно проходит внутренний перевод.";
    case "submitted":
      return "После фактического результата зафиксируйте финальное событие: исполнено, ошибка, возврат или аннулирование.";
    case "partially_settled":
      return "Проверьте остаток и решите, нужна ли еще одна инструкция или дополнительное событие исполнения.";
    case "settled":
      return input.positionCount > 0
        ? "Проверьте открытые позиции ниже и погасите их, если внутренний расчет уже закрыт."
        : "Дополнительных действий по этой операции обычно не требуется.";
    case "failed":
      return "Разберите причину ошибки и решите, можно ли отправлять сценарий повторно.";
    case "returned":
      return "Разберите возврат и решите, нужен ли новый платежный сценарий.";
    case "void":
      return "Операция завершена без дальнейших действий.";
    default:
      return "Сверьте текущее состояние с лентой инструкций и событий.";
  }
}

export function buildOperationTimelineWarning(input: {
  latestEventKind: string | null;
  status: string;
}) {
  const terminalMap: Record<string, string> = {
    failed: "failed",
    returned: "returned",
    settled: "settled",
    voided: "void",
  };

  if (!input.latestEventKind) {
    return null;
  }

  const expectedStatus = terminalMap[input.latestEventKind];
  if (!expectedStatus || expectedStatus === input.status) {
    return null;
  }

  return "Последнее событие в ленте не совпадает с текущим статусом операции. Проверьте, не зафиксированы ли события в неправильном порядке.";
}

export function getPositionKindMeaning(positionKind: string) {
  switch (positionKind) {
    case "customer_liability":
      return "Деньги уже пришли или ушли, но перед клиентом еще есть обязательство, которое нужно закрыть внутренним расчетом.";
    case "intercompany_due_from":
      return "Это внутреннее требование к компании группы: деньги были проведены, но взаиморасчеты внутри группы еще не закрыты.";
    case "intercompany_due_to":
      return "Это обязательство перед компанией группы, которое остается после исполнения и требует отдельного погашения.";
    case "in_transit":
      return "Деньги в пути: исполнение еще не дошло до финального этапа.";
    case "suspense":
      return "Невыясненная позиция: факт движения есть, но экономический смысл нужно дополнительно разобрать.";
    default:
      return "Внутренняя позиция treasury, требующая отдельного закрытия.";
  }
}

const TERMINAL_OPERATOR_EVENT_STATUSES = new Set([
  "settled",
  "failed",
  "returned",
  "void",
]);

export function canRecordOperatorExecutionEvent(instructionStatus: string) {
  return !TERMINAL_OPERATOR_EVENT_STATUSES.has(instructionStatus);
}

const TERMINAL_PAYMENT_ORDER_ARTIFACT_EVENTS = new Set([
  "failed",
  "returned",
  "voided",
]);

export function canGeneratePaymentOrderArtifact(input: {
  artifacts: TreasuryOperationArtifact[];
  operationTimeline: TreasuryOperationTimeline;
}) {
  if (input.operationTimeline.operation.operationKind !== "payout") {
    return false;
  }

  if (
    !input.operationTimeline.operation.sourceAccountId ||
    !input.operationTimeline.operation.sourceAmountMinor ||
    !input.operationTimeline.operation.sourceAssetId
  ) {
    return false;
  }

  if (
    input.artifacts.some((artifact) => artifact.docType === "payment_order")
  ) {
    return false;
  }

  const incomingInvoiceArtifacts = input.artifacts.filter(
    (artifact) =>
      artifact.docType === "incoming_invoice" &&
      artifact.linkKinds.includes("obligation"),
  );

  if (incomingInvoiceArtifacts.length !== 1) {
    return false;
  }

  const payoutInstructions = input.operationTimeline.instructionItems.filter(
    (instruction) => instruction.destinationEndpointId !== null,
  );

  if (payoutInstructions.length !== 1) {
    return false;
  }

  if (
    input.operationTimeline.eventItems.some((event) =>
      TERMINAL_PAYMENT_ORDER_ARTIFACT_EVENTS.has(event.eventKind),
    )
  ) {
    return false;
  }

  return true;
}

export function getBalanceGlossaryItems() {
  return [
    {
      label: "Учтено",
      description: "Полный остаток по счету после проведенных операций.",
    },
    {
      label: "Доступно",
      description: "Часть остатка, которую можно использовать прямо сейчас.",
    },
    {
      label: "Зарезервировано",
      description:
        "Сумма уже отложена под операции и не должна тратиться повторно.",
    },
    {
      label: "Ожидает",
      description:
        "Движение уже начато, но еще не дошло до финального результата.",
    },
  ];
}

export function getExceptionResolutionHint(record: {
  reasonCode: string;
  recordKind: string | null;
}) {
  if (record.reasonCode.includes("unmatched")) {
    return "Найдите соответствующую инструкцию или операцию и зафиксируйте событие исполнения по этой внешней записи.";
  }

  if (record.recordKind === "fee_charge") {
    return "Проверьте, относится ли запись к комиссии, и при необходимости зафиксируйте соответствующее событие вручную.";
  }

  return "Сопоставьте запись с операцией и инструкцией, чтобы исключение исчезло из рабочего списка.";
}

export function buildInstructionRouteSummary(input: {
  counterpartyEndpoint: CounterpartyEndpointListItem | null;
  treasuryEndpointLabel: string | null;
}) {
  if (input.treasuryEndpointLabel) {
    return input.treasuryEndpointLabel;
  }

  if (input.counterpartyEndpoint) {
    return input.counterpartyEndpoint.label ?? input.counterpartyEndpoint.value;
  }

  return "Реквизиты не указаны";
}
