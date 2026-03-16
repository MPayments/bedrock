import { DomainError } from "@bedrock/shared/core/domain";

import {
  CounterpartyRequisite,
  type CounterpartyRequisiteSnapshot,
} from "./counterparty-requisite";

export class CounterpartyRequisiteSet {
  private constructor(
    public readonly counterpartyId: string,
    public readonly currencyId: string,
    private readonly requisites: CounterpartyRequisite[],
  ) {}

  static fromSnapshot(input: {
    counterpartyId: string;
    currencyId: string;
    requisites: readonly CounterpartyRequisiteSnapshot[];
  }): CounterpartyRequisiteSet {
    const requisites = input.requisites.map((snapshot) =>
      CounterpartyRequisite.fromSnapshot(snapshot),
    );

    for (const requisite of requisites) {
      const snapshot = requisite.toSnapshot();

      if (snapshot.counterpartyId !== input.counterpartyId) {
        throw new DomainError(
          "counterparty_requisite.owner_mismatch",
          `Counterparty requisite ${snapshot.id} does not belong to counterparty ${input.counterpartyId}`,
        );
      }

      if (snapshot.currencyId !== input.currencyId) {
        throw new DomainError(
          "counterparty_requisite.currency_mismatch",
          `Counterparty requisite ${snapshot.id} does not belong to currency ${input.currencyId}`,
        );
      }

      if (snapshot.archivedAt) {
        throw new DomainError(
          "counterparty_requisite.archived_in_active_set",
          `Archived counterparty requisite ${snapshot.id} cannot be loaded into an active set`,
        );
      }
    }

    return new CounterpartyRequisiteSet(
      input.counterpartyId,
      input.currencyId,
      requisites,
    );
  }

  planCreate(
    candidateId: string,
    requestedIsDefault?: boolean,
  ): {
    candidateIsDefault: boolean;
    demotedIds: string[];
  } {
    const candidateIsDefault =
      requestedIsDefault === true || this.requisites.length === 0;

    return {
      candidateIsDefault,
      demotedIds: candidateIsDefault
        ? this.requisites.map((requisite) => requisite.id)
        : [],
    };
  }

  planUpdate(input: { requisiteId: string; nextIsDefault: boolean }): {
    demotedIds: string[];
    promotedId: string | null;
  } {
    const current = this.require(input.requisiteId);

    if (input.nextIsDefault) {
      return {
        demotedIds: this.requisites
          .filter((requisite) => requisite.id !== input.requisiteId)
          .map((requisite) => requisite.id),
        promotedId: null,
      };
    }

    if (current.toSnapshot().isDefault) {
      return {
        demotedIds: [],
        promotedId:
          this.requisites.find(
            (requisite) => requisite.id !== input.requisiteId,
          )?.id ?? null,
      };
    }

    return {
      demotedIds: [],
      promotedId: null,
    };
  }

  planTransferOut(requisiteId: string): {
    promotedId: string | null;
  } {
    const current = this.require(requisiteId);

    if (!current.toSnapshot().isDefault) {
      return { promotedId: null };
    }

    return {
      promotedId:
        this.requisites.find((requisite) => requisite.id !== requisiteId)?.id ??
        null,
    };
  }

  planTransferIn(input: { nextIsDefault: boolean }): {
    demotedIds: string[];
  } {
    return {
      demotedIds: input.nextIsDefault
        ? this.requisites.map((requisite) => requisite.id)
        : [],
    };
  }

  planArchive(requisiteId: string): {
    promotedId: string | null;
  } {
    return this.planTransferOut(requisiteId);
  }

  private require(requisiteId: string): CounterpartyRequisite {
    const requisite = this.requisites.find((item) => item.id === requisiteId);
    if (!requisite) {
      throw new DomainError(
        "counterparty_requisite.not_found_in_set",
        `Counterparty requisite not found in set: ${requisiteId}`,
        { requisiteId },
      );
    }

    return requisite;
  }
}
