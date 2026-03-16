import { DomainError } from "@bedrock/shared/core/domain";

import {
  Requisite,
  type RequisiteSnapshot,
} from "./requisite";
import type { RequisiteOwnerType } from "./owner";

export class RequisiteSet {
  private constructor(
    public readonly ownerType: RequisiteOwnerType,
    public readonly ownerId: string,
    public readonly currencyId: string,
    private readonly requisites: Requisite[],
  ) {}

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
          "requisite.owner_type_mismatch",
          `Requisite ${snapshot.id} does not belong to owner type ${input.ownerType}`,
        );
      }

      if (snapshot.ownerId !== input.ownerId) {
        throw new DomainError(
          "requisite.owner_mismatch",
          `Requisite ${snapshot.id} does not belong to owner ${input.ownerId}`,
        );
      }

      if (snapshot.currencyId !== input.currencyId) {
        throw new DomainError(
          "requisite.currency_mismatch",
          `Requisite ${snapshot.id} does not belong to currency ${input.currencyId}`,
        );
      }

      if (snapshot.archivedAt) {
        throw new DomainError(
          "requisite.archived_in_active_set",
          `Archived requisite ${snapshot.id} cannot be loaded into an active set`,
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
        ? this.requisites
          .filter((requisite) => requisite.id !== candidateId)
          .map((requisite) => requisite.id)
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

  private require(requisiteId: string): Requisite {
    const requisite = this.requisites.find((item) => item.id === requisiteId);

    if (!requisite) {
      throw new DomainError(
        "requisite.not_found_in_set",
        `Requisite not found in set: ${requisiteId}`,
        { requisiteId },
      );
    }

    return requisite;
  }
}
