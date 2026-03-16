import {
  DomainError,
  Entity,
  normalizeOptionalText,
} from "@bedrock/shared/core/domain";

import type { BalanceEventInput } from "./balance-events";
import type {
  BalanceHoldRecord,
  BalanceHoldUpdate,
} from "./balance-hold";
import type {
  BalancePositionDelta,
  BalanceSnapshot,
} from "./balance-position";
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
  private constructor(private readonly props: BalanceStateProps) {
    super(BalanceState.buildId(props.balance));
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
    const existingHold = this.findHold(input.holdRef);

    if (existingHold) {
      if (existingHold.amountMinor !== input.amountMinor) {
        throw new DomainError(
          "balances.hold.conflict",
          "balance hold already exists with a different amount",
          { holdRef: input.holdRef },
        );
      }

      return { kind: "replay" };
    }

    if (this.props.balance.available < input.amountMinor) {
      throw new DomainError(
        "balances.insufficient_available",
        "insufficient available balance",
        {
          available: this.props.balance.available,
          requested: input.amountMinor,
        },
      );
    }

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
        actorId: input.actorId ?? null,
        requestContext: input.requestContext,
      },
      event: {
        eventType: "reserve",
        holdRef: input.holdRef,
        deltaAvailable: -input.amountMinor,
        deltaReserved: input.amountMinor,
        actorId: input.actorId,
        requestContext: input.requestContext,
        meta: input.reason ? { reason: input.reason } : null,
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
    const hold = this.requireHold(input.holdRef);

    if (hold.state === "released") {
      return { kind: "replay" };
    }

    if (hold.state !== "active") {
      throw new DomainError(
        "balances.hold.invalid_state",
        `cannot release balance hold while in state ${hold.state}`,
        { holdRef: input.holdRef, state: hold.state, action: "release" },
      );
    }

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
        actorId: input.actorId ?? hold.actorId,
        releasedAt: input.now,
      },
      event: {
        eventType: "release",
        holdRef: input.holdRef,
        deltaAvailable: hold.amountMinor,
        deltaReserved: -hold.amountMinor,
        actorId: input.actorId,
        requestContext: input.requestContext,
        meta: input.reason ? { reason: input.reason } : null,
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
    const hold = this.requireHold(input.holdRef);

    if (hold.state === "consumed") {
      return { kind: "replay" };
    }

    if (hold.state !== "active") {
      throw new DomainError(
        "balances.hold.invalid_state",
        `cannot consume balance hold while in state ${hold.state}`,
        { holdRef: input.holdRef, state: hold.state, action: "consume" },
      );
    }

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
        actorId: input.actorId ?? hold.actorId,
        consumedAt: input.now,
      },
      event: {
        eventType: "consume",
        holdRef: input.holdRef,
        deltaReserved: -hold.amountMinor,
        deltaPending: hold.amountMinor,
        actorId: input.actorId,
        requestContext: input.requestContext,
        meta: input.reason ? { reason: input.reason } : null,
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
      bookId: this.props.balance.bookId,
      subjectType: this.props.balance.subjectType,
      subjectId: this.props.balance.subjectId,
      currency: this.props.balance.currency,
    };
  }

  private findHold(holdRef: string): BalanceHoldRecord | null {
    return this.props.holds.find((hold) => hold.holdRef === holdRef) ?? null;
  }

  private requireHold(holdRef: string): BalanceHoldRecord {
    const hold = this.findHold(holdRef);

    if (!hold) {
      throw new DomainError(
        "balances.hold.not_found",
        "balance hold not found",
        { holdRef },
      );
    }

    return hold;
  }
}
