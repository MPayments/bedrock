import { AggregateRoot, DomainError } from "@bedrock/shared/core/domain";

import type { RequisiteOwnerType } from "./owner";
import {
  Requisite,
  type CreateRequisiteProps,
  type RequisiteSnapshot,
  type UpdateRequisiteProps,
} from "./requisite";

function makeRequisiteSetId(input: {
  ownerType: RequisiteOwnerType;
  ownerId: string;
  currencyId: string;
}) {
  return `${input.ownerType}:${input.ownerId}:${input.currencyId}`;
}

export class RequisiteSet extends AggregateRoot<string> {
  private constructor(
    public readonly ownerType: RequisiteOwnerType,
    public readonly ownerId: string,
    public readonly currencyId: string,
    private readonly requisites: Requisite[],
  ) {
    super({
      id: makeRequisiteSetId({
        ownerType,
        ownerId,
        currencyId,
      }),
      props: {},
    });
  }

  static empty(input: {
    ownerType: RequisiteOwnerType;
    ownerId: string;
    currencyId: string;
  }): RequisiteSet {
    return new RequisiteSet(
      input.ownerType,
      input.ownerId,
      input.currencyId,
      [],
    );
  }

  static fromSnapshot(input: {
    ownerType: RequisiteOwnerType;
    ownerId: string;
    currencyId: string;
    requisites: readonly RequisiteSnapshot[];
  }): RequisiteSet {
    const requisites = input.requisites.map((snapshot) =>
      Requisite.fromSnapshot(snapshot),
    );

    for (const requisite of requisites) {
      const snapshot = requisite.toSnapshot();

      if (snapshot.ownerType !== input.ownerType) {
        throw new DomainError(
          `Requisite ${snapshot.id} does not belong to owner type ${input.ownerType}`,
          {
            code: "requisite.owner_type_mismatch",
          },
        );
      }

      if (snapshot.ownerId !== input.ownerId) {
        throw new DomainError(
          `Requisite ${snapshot.id} does not belong to owner ${input.ownerId}`,
          {
            code: "requisite.owner_mismatch",
          },
        );
      }

      if (snapshot.currencyId !== input.currencyId) {
        throw new DomainError(
          `Requisite ${snapshot.id} does not belong to currency ${input.currencyId}`,
          {
            code: "requisite.currency_mismatch",
          },
        );
      }
    }

    return new RequisiteSet(
      input.ownerType,
      input.ownerId,
      input.currencyId,
      requisites,
    );
  }

  toSnapshots(): RequisiteSnapshot[] {
    return this.requisites.map((requisite) => requisite.toSnapshot());
  }

  createRequisite(
    input: Omit<CreateRequisiteProps, "currencyId" | "isDefault" | "ownerId" | "ownerType"> & {
      requestedIsDefault?: boolean;
    },
    now: Date,
  ): {
    requisite: Requisite;
    set: RequisiteSet;
  } {
    const candidateIsDefault =
      input.requestedIsDefault === true || this.listActive().length === 0;
    const created = Requisite.create(
      {
        ...input,
        ownerType: this.ownerType,
        ownerId: this.ownerId,
        currencyId: this.currencyId,
        isDefault: candidateIsDefault,
      },
      now,
    );
    const nextRequisites = candidateIsDefault
      ? [
          ...this.demoteActiveDefaults(now),
          created,
        ]
      : [...this.requisites, created];

    return {
      requisite: created,
      set: this.withRequisites(nextRequisites, {
        name: "requisite.created",
        payload: {
          requisiteId: created.id,
          ownerType: this.ownerType,
          ownerId: this.ownerId,
          currencyId: this.currencyId,
        },
      }),
    };
  }

  updateRequisite(
    requisiteId: string,
    input: UpdateRequisiteProps,
    now: Date,
  ): {
    requisite: Requisite;
    set: RequisiteSet;
  } {
    if (input.currencyId !== this.currencyId) {
      throw new DomainError(
        `Requisite ${requisiteId} does not belong to currency ${this.currencyId}`,
        {
          code: "requisite.currency_mismatch",
          meta: {
            requisiteId,
            currencyId: input.currencyId,
            setCurrencyId: this.currencyId,
          },
        },
      );
    }

    const current = this.requireActive(requisiteId);
    const updated = current.update(input, now);
    const otherActive = this.listActive().filter(
      (requisite) => requisite.id !== requisiteId,
    );
    const replacementMap = new Map<string, Requisite>();

    replacementMap.set(updated.id, updated);

    if (updated.isDefault()) {
      for (const requisite of otherActive) {
        replacementMap.set(requisite.id, requisite.withDefaultState(false, now));
      }
    } else if (current.isDefault()) {
      const promoted = otherActive[0];
      if (promoted) {
        replacementMap.set(promoted.id, promoted.withDefaultState(true, now));
      }
    }

    const next = this.requisites.map((requisite) =>
      replacementMap.get(requisite.id) ?? requisite,
    );

    return {
      requisite: replacementMap.get(updated.id)!,
      set: this.withRequisites(next, {
        name: "requisite.updated",
        payload: {
          requisiteId,
          ownerType: this.ownerType,
          ownerId: this.ownerId,
          currencyId: this.currencyId,
        },
      }),
    };
  }

  archiveRequisite(
    requisiteId: string,
    now: Date,
  ): {
    requisite: Requisite;
    set: RequisiteSet;
  } {
    const current = this.requireActive(requisiteId);
    const archived = current.archive(now);
    const otherActive = this.listActive().filter(
      (requisite) => requisite.id !== requisiteId,
    );
    const replacementMap = new Map<string, Requisite>([[archived.id, archived]]);

    if (current.isDefault()) {
      const promoted = otherActive[0];
      if (promoted) {
        replacementMap.set(promoted.id, promoted.withDefaultState(true, now));
      }
    }

    const next = this.requisites.map((requisite) =>
      replacementMap.get(requisite.id) ?? requisite,
    );

    return {
      requisite: archived,
      set: this.withRequisites(next, {
        name: "requisite.archived",
        payload: {
          requisiteId,
          ownerType: this.ownerType,
          ownerId: this.ownerId,
          currencyId: this.currencyId,
        },
      }),
    };
  }

  detachRequisite(
    requisiteId: string,
    now: Date,
  ): {
    requisite: Requisite;
    set: RequisiteSet;
  } {
    const current = this.requireActive(requisiteId);
    const detached = current.withDefaultState(false, now);
    const next = this.requisites.filter((requisite) => requisite.id !== requisiteId);

    if (current.isDefault()) {
      const promoted = next.find(
        (requisite) => !requisite.isArchived(),
      );

      if (promoted) {
        const replacement = promoted.withDefaultState(true, now);
        return {
          requisite: detached,
          set: this.withRequisites(
            next.map((requisite) =>
              requisite.id === replacement.id ? replacement : requisite,
            ),
            {
              name: "requisite.transferred_out",
              payload: {
                requisiteId,
                ownerType: this.ownerType,
                ownerId: this.ownerId,
                currencyId: this.currencyId,
              },
            },
          ),
        };
      }
    }

    return {
      requisite: detached,
      set: this.withRequisites(next, {
        name: "requisite.transferred_out",
        payload: {
          requisiteId,
          ownerType: this.ownerType,
          ownerId: this.ownerId,
          currencyId: this.currencyId,
        },
      }),
    };
  }

  attachTransferredRequisite(
    requisite: Requisite,
    input: UpdateRequisiteProps,
    now: Date,
  ): {
    requisite: Requisite;
    set: RequisiteSet;
  } {
    if (input.currencyId !== this.currencyId) {
      throw new DomainError(
        `Requisite ${requisite.id} does not belong to currency ${this.currencyId}`,
        {
          code: "requisite.currency_mismatch",
          meta: {
            requisiteId: requisite.id,
            currencyId: input.currencyId,
            setCurrencyId: this.currencyId,
          },
        },
      );
    }

    const transferred = requisite.update(input, now);
    const nextRequisites = transferred.isDefault()
      ? [
          ...this.demoteActiveDefaults(now),
          transferred,
        ]
      : [...this.requisites, transferred];

    return {
      requisite: transferred,
      set: this.withRequisites(nextRequisites, {
        name: "requisite.transferred_in",
        payload: {
          requisiteId: requisite.id,
          ownerType: this.ownerType,
          ownerId: this.ownerId,
          currencyId: this.currencyId,
        },
      }),
    };
  }

  private listActive(): Requisite[] {
    return this.requisites.filter((requisite) => !requisite.isArchived());
  }

  private demoteActiveDefaults(now: Date): Requisite[] {
    return this.requisites.map((requisite) =>
      !requisite.isArchived() && requisite.isDefault()
        ? requisite.withDefaultState(false, now)
        : requisite,
    );
  }

  private requireActive(requisiteId: string): Requisite {
    const requisite = this.listActive().find((item) => item.id === requisiteId);

    if (!requisite) {
      throw new DomainError(
        `Requisite not found in set: ${requisiteId}`,
        {
          code: "requisite.not_found_in_set",
          meta: { requisiteId },
        },
      );
    }

    return requisite;
  }

  private withRequisites(
    requisites: Requisite[],
    event: {
      name: string;
      payload: Record<string, unknown>;
    },
  ): RequisiteSet {
    const next = new RequisiteSet(
      this.ownerType,
      this.ownerId,
      this.currencyId,
      requisites,
    );

    next.raiseDomainEvent({
      name: event.name,
      payload: event.payload,
    });

    return next;
  }
}
