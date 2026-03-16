import { DomainError } from "@bedrock/shared/core/domain";

import {
  OrganizationRequisite,
  type OrganizationRequisiteSnapshot,
} from "./organization-requisite";

export class OrganizationRequisiteSet {
  private constructor(
    public readonly organizationId: string,
    public readonly currencyId: string,
    private readonly requisites: OrganizationRequisite[],
  ) {}

  static fromSnapshot(input: {
    organizationId: string;
    currencyId: string;
    requisites: readonly OrganizationRequisiteSnapshot[];
  }): OrganizationRequisiteSet {
    const requisites = input.requisites.map((snapshot) =>
      OrganizationRequisite.fromSnapshot(snapshot),
    );

    for (const requisite of requisites) {
      const snapshot = requisite.toSnapshot();

      if (snapshot.organizationId !== input.organizationId) {
        throw new DomainError(
          "organization_requisite.owner_mismatch",
          `Organization requisite ${snapshot.id} does not belong to organization ${input.organizationId}`,
        );
      }

      if (snapshot.currencyId !== input.currencyId) {
        throw new DomainError(
          "organization_requisite.currency_mismatch",
          `Organization requisite ${snapshot.id} does not belong to currency ${input.currencyId}`,
        );
      }

      if (snapshot.archivedAt) {
        throw new DomainError(
          "organization_requisite.archived_in_active_set",
          `Archived organization requisite ${snapshot.id} cannot be loaded into an active set`,
        );
      }
    }

    return new OrganizationRequisiteSet(
      input.organizationId,
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

  private require(requisiteId: string): OrganizationRequisite {
    const requisite = this.requisites.find((item) => item.id === requisiteId);

    if (!requisite) {
      throw new DomainError(
        "organization_requisite.not_found_in_set",
        `Organization requisite not found in set: ${requisiteId}`,
        { requisiteId },
      );
    }

    return requisite;
  }
}
