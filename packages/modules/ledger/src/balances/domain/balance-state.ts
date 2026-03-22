import {
  Entity,
  invariant,
  normalizeOptionalText,
} from "@bedrock/shared/core/domain";

import {
  normalizeBalanceEventRequestContext,
  type BalanceEventInput,
} from "./balance-events";
import type { BalanceHoldRecord, BalanceHoldUpdate } from "./balance-hold";
import type { BalancePositionDelta, BalanceSnapshot } from "./balance-position";
import type { BalanceSubject } from "./balance-subject";

interface BalanceStateProps {
  balance: BalanceSnapshot;
  holds: BalanceHoldRecord[];
}

interface ReserveBalancePlan {
  kind: "reserve";
  delta: BalancePositionDelta;
  hold: {
    subject: BalanceSubject;
    holdRef: string;
    amountMinor: bigint;
    state: BalanceHoldRecord["state"];
    reason?: string | null;
    actorId?: string | null;
    requestContext?: BalanceEventInput["requestContext"];
  };
  event: Omit<BalanceEventInput, "subject" | "version">;
}

interface UpdateBalancePlan {
  kind: "update";
  delta: BalancePositionDelta;
  holdId: string;
  holdUpdate: BalanceHoldUpdate;
  event: Omit<BalanceEventInput, "subject" | "version">;
}

interface ReplayBalancePlan {
  kind: "replay";
}

export type BalanceMutationPlan =
  | ReserveBalancePlan
  | UpdateBalancePlan
  | ReplayBalancePlan;

export class BalanceState extends Entity<string> {
  private constructor(private readonly state: BalanceStateProps) {
    super({
      id: BalanceState.buildId(state.balance),
      props: {},
    });
  }

  static fromSnapshot(input: BalanceStateProps): BalanceState {
    return new BalanceState({
      balance: { ...input.balance },
      holds: input.holds.map((hold) => ({ ...hold })),
    });
  }

  reserve(input: {
    holdRef: string;
    amountMinor: bigint;
    reason?: string | null;
    actorId?: string | null;
    requestContext?: BalanceEventInput["requestContext"];
  }): BalanceMutationPlan {
    const actorId = input.actorId ?? null;
    const requestContext = normalizeBalanceEventRequestContext(
      input.requestContext,
    );
    const existingHold = this.findHold(input.holdRef);

    if (existingHold) {
      invariant(
        existingHold.amountMinor === input.amountMinor,
        "balance hold already exists with a different amount",
        {
          code: "balances.hold.conflict",
          meta: { holdRef: input.holdRef },
        },
      );

      return { kind: "replay" };
    }

    invariant(
      this.state.balance.available >= input.amountMinor,
      "insufficient available balance",
      {
        code: "balances.insufficient_available",
        meta: {
          available: this.state.balance.available,
          requested: input.amountMinor,
        },
      },
    );

    return {
      kind: "reserve",
      delta: {
        deltaAvailable: -input.amountMinor,
        deltaReserved: input.amountMinor,
      },
      hold: {
        subject: this.subject,
        holdRef: input.holdRef,
        amountMinor: input.amountMinor,
        state: "active",
        reason: normalizeOptionalText(input.reason),
        actorId,
        ...(requestContext ? { requestContext } : {}),
      },
      event: {
        eventType: "reserve",
        holdRef: input.holdRef,
        deltaAvailable: -input.amountMinor,
        deltaReserved: input.amountMinor,
        actorId,
        meta: input.reason ? { reason: input.reason } : null,
        ...(requestContext ? { requestContext } : {}),
      },
    };
  }

  release(input: {
    holdRef: string;
    reason?: string | null;
    actorId?: string | null;
    requestContext?: BalanceEventInput["requestContext"];
    now: Date;
  }): BalanceMutationPlan {
    const actorId = input.actorId ?? null;
    const requestContext = normalizeBalanceEventRequestContext(
      input.requestContext,
    );
    const hold = this.requireHold(input.holdRef);

    if (hold.state === "released") {
      return { kind: "replay" };
    }

    invariant(
      hold.state === "active",
      `cannot release balance hold while in state ${hold.state}`,
      {
        code: "balances.hold.invalid_state",
        meta: {
          holdRef: input.holdRef,
          state: hold.state,
          action: "release",
        },
      },
    );

    return {
      kind: "update",
      delta: {
        deltaAvailable: hold.amountMinor,
        deltaReserved: -hold.amountMinor,
      },
      holdId: hold.id,
      holdUpdate: {
        state: "released",
        reason: normalizeOptionalText(input.reason) ?? hold.reason,
        actorId: actorId ?? hold.actorId,
        releasedAt: input.now,
      },
      event: {
        eventType: "release",
        holdRef: input.holdRef,
        deltaAvailable: hold.amountMinor,
        deltaReserved: -hold.amountMinor,
        actorId,
        meta: input.reason ? { reason: input.reason } : null,
        ...(requestContext ? { requestContext } : {}),
      },
    };
  }

  consume(input: {
    holdRef: string;
    reason?: string | null;
    actorId?: string | null;
    requestContext?: BalanceEventInput["requestContext"];
    now: Date;
  }): BalanceMutationPlan {
    const actorId = input.actorId ?? null;
    const requestContext = normalizeBalanceEventRequestContext(
      input.requestContext,
    );
    const hold = this.requireHold(input.holdRef);

    if (hold.state === "consumed") {
      return { kind: "replay" };
    }

    invariant(
      hold.state === "active",
      `cannot consume balance hold while in state ${hold.state}`,
      {
        code: "balances.hold.invalid_state",
        meta: {
          holdRef: input.holdRef,
          state: hold.state,
          action: "consume",
        },
      },
    );

    return {
      kind: "update",
      delta: {
        deltaReserved: -hold.amountMinor,
        deltaPending: hold.amountMinor,
      },
      holdId: hold.id,
      holdUpdate: {
        state: "consumed",
        reason: normalizeOptionalText(input.reason) ?? hold.reason,
        actorId: actorId ?? hold.actorId,
        consumedAt: input.now,
      },
      event: {
        eventType: "consume",
        holdRef: input.holdRef,
        deltaReserved: -hold.amountMinor,
        deltaPending: hold.amountMinor,
        actorId,
        meta: input.reason ? { reason: input.reason } : null,
        ...(requestContext ? { requestContext } : {}),
      },
    };
  }

  private static buildId(balance: BalanceSnapshot): string {
    return [
      balance.bookId,
      balance.subjectType,
      balance.subjectId,
      balance.currency,
    ].join(":");
  }

  private get subject(): BalanceSubject {
    return {
      bookId: this.state.balance.bookId,
      subjectType: this.state.balance.subjectType,
      subjectId: this.state.balance.subjectId,
      currency: this.state.balance.currency,
    };
  }

  private findHold(holdRef: string) {
    return this.state.holds.find((hold) => hold.holdRef === holdRef) ?? null;
  }

  private requireHold(holdRef: string) {
    const hold = this.findHold(holdRef);

    invariant(hold, "balance hold not found", {
      code: "balances.hold.not_found",
      meta: { holdRef },
    });

    return hold;
  }
}
