import type { ComponentManifest } from "./types";

export const BEDROCK_CORE_COMPONENT_MANIFESTS = [
  {
    id: "system-components",
    version: 2,
    kind: "control",
    mutability: "immutable",
    description: "Панель управления runtime-компонентами",
    enabledByDefault: true,
    scopeSupport: { global: true, book: false },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/system/components",
        guarded: false,
      },
    },
    dependencies: [],
  },
  {
    id: "idempotency",
    version: 1,
    kind: "kernel",
    mutability: "immutable",
    description: "Ядро идемпотентности",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {},
    dependencies: [],
  },
  {
    id: "ledger",
    version: 1,
    kind: "kernel",
    mutability: "immutable",
    description: "Рантайм исполнения ledger",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      workers: [
        {
          id: "ledger",
          envKey: "LEDGER_WORKER_INTERVAL_MS",
          defaultIntervalMs: 5_000,
          description: "Проводит отложенные операции ledger в TigerBeetle.",
        },
      ],
    },
    dependencies: [],
  },
  {
    id: "accounting",
    version: 1,
    kind: "kernel",
    mutability: "immutable",
    description: "Рантайм бухгалтерии",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/accounting",
      },
    },
    dependencies: [
      {
        componentId: "ledger",

        reason: "Проведение бухгалтерии сохраняется через операции ledger",
      },
      {
        componentId: "idempotency",

        reason: "Записи бухгалтерии опираются на идемпотентную семантику операций",
      },
    ],
  },
  {
    id: "documents",
    version: 1,
    kind: "kernel",
    mutability: "immutable",
    description: "Рантайм документооборота",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      workers: [
        {
          id: "documents",
          envKey: "DOCUMENTS_WORKER_INTERVAL_MS",
          defaultIntervalMs: 5_000,
          description: "Завершает статусы проведения документов по результатам ledger.",
        },
        {
          id: "documents-period-close",
          envKey: "DOCUMENTS_PERIOD_CLOSE_WORKER_INTERVAL_MS",
          defaultIntervalMs: 60_000,
          description:
            "Генерирует ежемесячные документы period_close и закрывает периоды контрагентов.",
        },
      ],
    },
    dependencies: [
      {
        componentId: "accounting",

        reason: "Проведение документов выполняется через runtime бухгалтерии",
      },
      {
        componentId: "ledger",

        reason: "Проведение документов записывает операции ledger",
      },
      {
        componentId: "idempotency",

        reason: "Действия с документами используют идемпотентные квитанции действий",
      },
    ],
  },
  {
    id: "counterparty-accounts",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Компонент счетов контрагентов",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/counterparty-accounts",
      },
    },
    dependencies: [],
  },
  {
    id: "counterparty-account-providers",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Компонент провайдеров счетов контрагентов",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/counterparty-account-providers",
      },
    },
    dependencies: [
      {
        componentId: "counterparty-accounts",

        reason: "Провайдеры привязаны к счетам контрагентов",
      },
    ],
  },
  {
    id: "counterparties",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Компонент контрагентов",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/counterparties",
      },
    },
    dependencies: [],
  },
  {
    id: "counterparty-groups",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Компонент групп контрагентов",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/counterparty-groups",
      },
    },
    dependencies: [
      {
        componentId: "counterparties",

        reason: "Группы агрегируют контрагентов",
      },
    ],
  },
  {
    id: "customers",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Компонент клиентов",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/customers",
      },
    },
    dependencies: [],
  },
  {
    id: "currencies",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Компонент валют",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/currencies",
      },
    },
    dependencies: [],
  },
  {
    id: "balances",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Рантайм и проектор балансов",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/balances",
      },
      workers: [
        {
          id: "balances",
          envKey: "BALANCES_WORKER_INTERVAL_MS",
          defaultIntervalMs: 5_000,
          description: "Проецирует проведенные записи ledger в балансовые позиции.",
        },
      ],
    },
    dependencies: [
      {
        componentId: "ledger",

        reason: "Баланс формируется из событий ledger",
      },
    ],
  },
  {
    id: "reconciliation",
    version: 1,
    kind: "domain",
    mutability: "mutable",
    description: "Рантайм сверки",
    enabledByDefault: true,
    scopeSupport: { global: true, book: true },

    capabilities: {
      api: {
        version: "v1",
        routePath: "/reconciliation",
      },
      workers: [
        {
          id: "reconciliation",
          envKey: "RECONCILIATION_WORKER_INTERVAL_MS",
          defaultIntervalMs: 60_000,
          description:
            "Запускает батчи сверки для ожидающих внешних записей.",
        },
      ],
    },
    dependencies: [
      {
        componentId: "documents",

        reason: "Сверка использует document workflow для корректировок",
      },
      {
        componentId: "idempotency",

        reason: "Записи сверки идемпотентны",
      },
    ],
  },
] as const satisfies ComponentManifest[];

export type BedrockCoreComponentId =
  (typeof BEDROCK_CORE_COMPONENT_MANIFESTS)[number]["id"];
