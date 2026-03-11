import type {
  RegisteredWorkerTrigger,
  WorkerAdapter,
  WorkerAdapterCapabilities,
  WorkerAdapterDelivery,
  WorkerDispatchOptions,
  WorkerDispatchReceipt,
  WorkerExecutionResult,
  WorkerRuntimeBridge,
} from "@bedrock/core";

const DEFAULT_CAPABILITIES: WorkerAdapterCapabilities = {
  dispatch: true,
  subscription: true,
  schedule: true,
  delay: true,
  heartbeat: true,
  drain: true,
};

export type InMemoryWorkerAdapterOptions = {
  name?: string;
  now?: () => Date;
  capabilities?: Partial<WorkerAdapterCapabilities>;
};

export type InMemoryWorkerDeliveryResult = {
  delivery: WorkerAdapterDelivery;
  result: WorkerExecutionResult;
};

export type InMemoryWorkerAdapter = WorkerAdapter & {
  deliver(delivery: WorkerAdapterDelivery): Promise<WorkerExecutionResult>;
  deliverNext(): Promise<InMemoryWorkerDeliveryResult | null>;
  deliverAll(): Promise<InMemoryWorkerDeliveryResult[]>;
  getPendingDeliveries(): readonly WorkerAdapterDelivery[];
  getRegisteredTriggers(): readonly RegisteredWorkerTrigger[];
};

export function createInMemoryWorkerAdapter(
  options: InMemoryWorkerAdapterOptions = {},
): InMemoryWorkerAdapter {
  const name = options.name ?? "memory";
  const now = options.now ?? (() => new Date());
  const registeredTriggers: RegisteredWorkerTrigger[] = [];
  const pendingDeliveries: WorkerAdapterDelivery[] = [];
  let bridge: WorkerRuntimeBridge | null = null;
  let dispatchCount = 0;

  const executeDelivery = async (
    delivery: WorkerAdapterDelivery,
  ): Promise<WorkerExecutionResult> => {
    if (!bridge) {
      throw new Error("Worker triggers were not registered.");
    }

    return bridge.executeDelivery(delivery);
  };

  const computeScheduledAt = (
    acceptedAt: Date,
    dispatchOptions: WorkerDispatchOptions | undefined,
  ): Date | undefined => {
    if (dispatchOptions?.scheduleAt) {
      return dispatchOptions.scheduleAt;
    }

    if (dispatchOptions?.delayMs !== undefined) {
      return new Date(acceptedAt.getTime() + dispatchOptions.delayMs);
    }

    return undefined;
  };

  const computeRetryScheduledAt = (
    delivery: WorkerAdapterDelivery,
    result: Extract<WorkerExecutionResult, { disposition: "retry" }>,
  ): Date | undefined => {
    if (result.delayMs === undefined) {
      return delivery.scheduledAt;
    }

    return new Date(now().getTime() + result.delayMs);
  };

  const findNextReadyDeliveryIndex = (): number =>
    pendingDeliveries.findIndex((delivery) => {
      if (!delivery.scheduledAt) {
        return true;
      }

      return delivery.scheduledAt.getTime() <= now().getTime();
    });

  return {
    name,
    capabilities: {
      ...DEFAULT_CAPABILITIES,
      ...options.capabilities,
    },
    async registerTriggers(triggers, nextBridge) {
      registeredTriggers.splice(0, registeredTriggers.length, ...triggers);
      bridge = nextBridge;
    },
    async dispatch(triggerId, input, dispatchOptions) {
      const triggerRegistered = registeredTriggers.some(
        (trigger) => trigger.id === triggerId,
      );

      if (!triggerRegistered) {
        throw new Error(`Worker trigger "${triggerId}" is not registered.`);
      }

      dispatchCount += 1;

      const acceptedAt = now();
      const scheduledAt = computeScheduledAt(acceptedAt, dispatchOptions);
      const messageId = dispatchOptions?.messageId ?? `dispatch-${dispatchCount}`;
      const delivery: WorkerAdapterDelivery = {
        triggerId,
        input,
        messageId,
        attempt: 1,
        headers: dispatchOptions?.headers,
        enqueuedAt: acceptedAt,
        scheduledAt,
      };

      pendingDeliveries.push(delivery);

      return {
        triggerId,
        messageId,
        adapter: name,
        acceptedAt,
        scheduledAt,
      } satisfies WorkerDispatchReceipt;
    },
    async start() {},
    async stop(stopOptions) {
      if (!stopOptions?.drain) {
        return;
      }

      await this.deliverAll();
    },
    async deliver(delivery) {
      return executeDelivery(delivery);
    },
    async deliverNext() {
      const index = findNextReadyDeliveryIndex();

      if (index < 0) {
        return null;
      }

      const delivery = pendingDeliveries.splice(index, 1)[0]!;

      const result = await executeDelivery(delivery);

      if (result.disposition === "retry") {
        pendingDeliveries.push({
          ...delivery,
          attempt: delivery.attempt + 1,
          scheduledAt: computeRetryScheduledAt(delivery, result),
        });
      }

      return {
        delivery,
        result,
      };
    },
    async deliverAll() {
      const results: InMemoryWorkerDeliveryResult[] = [];

      while (true) {
        const next = await this.deliverNext();

        if (!next) {
          break;
        }

        results.push(next);
      }

      return results;
    },
    getPendingDeliveries() {
      return [...pendingDeliveries];
    },
    getRegisteredTriggers() {
      return [...registeredTriggers];
    },
  };
}
