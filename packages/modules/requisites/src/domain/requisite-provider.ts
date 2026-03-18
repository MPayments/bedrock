import {
  applyPatch,
  Entity,
  invariant,
  normalizeOptionalText,
  normalizeRequiredText,
} from "@bedrock/shared/core";

import { normalizeCountryCode } from "./country-code";
import { isBankLikeRequisiteKind, type RequisiteKind } from "./requisite-kind";

export interface RequisiteProviderSnapshot {
  id: string;
  kind: RequisiteKind;
  name: string;
  description: string | null;
  country: string | null;
  address: string | null;
  contact: string | null;
  bic: string | null;
  swift: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequisiteProviderDetails {
  kind: RequisiteKind;
  name: string;
  description: string | null;
  country: string | null;
  address: string | null;
  contact: string | null;
  bic: string | null;
  swift: string | null;
}

export function validateRequisiteProviderDetails(
  input: RequisiteProviderDetails,
) {
  const kind = input.kind;
  const country = normalizeCountryCode(input.country);
  const bic = normalizeOptionalText(input.bic);
  const swift = normalizeOptionalText(input.swift);

  normalizeRequiredText(input.name, "requisite_provider.name.required", "name");

  if (isBankLikeRequisiteKind(kind)) {
    invariant(
      country !== null,
      "requisite_provider.country.required",
      `country is required for ${kind} providers`,
      { field: "country", kind },
    );
  }

  if (kind === "bank") {
    if (country === "RU") {
      invariant(
        bic !== null,
        "requisite_provider.bic.required",
        "bic is required for Russian banks",
        { field: "bic", kind, country },
      );
    } else if (country !== null) {
      invariant(
        swift !== null,
        "requisite_provider.swift.required",
        "swift is required for non-Russian banks",
        { field: "swift", kind, country },
      );
    }
  } else {
    invariant(
      bic === null,
      "requisite_provider.bic.not_allowed",
      "bic is only allowed for bank providers",
      { field: "bic", kind },
    );
    invariant(
      !(kind === "blockchain" && swift !== null),
      "requisite_provider.swift.not_allowed",
      "swift is not applicable for blockchain providers",
      { field: "swift", kind },
    );
  }
}

function normalizeDetails(
  input: RequisiteProviderDetails,
): Omit<
  RequisiteProviderSnapshot,
  "id" | "archivedAt" | "createdAt" | "updatedAt"
> {
  validateRequisiteProviderDetails(input);

  return {
    kind: input.kind,
    name: normalizeRequiredText(
      input.name,
      "requisite_provider.name.required",
      "name",
    ),
    description: normalizeOptionalText(input.description),
    country: normalizeCountryCode(input.country),
    address: normalizeOptionalText(input.address),
    contact: normalizeOptionalText(input.contact),
    bic: normalizeOptionalText(input.bic),
    swift: normalizeOptionalText(input.swift),
  };
}

function normalizeRequisiteProviderSnapshot(
  snapshot: RequisiteProviderSnapshot,
): RequisiteProviderSnapshot {
  return {
    ...snapshot,
    ...normalizeDetails(snapshot),
    archivedAt: snapshot.archivedAt ?? null,
  };
}

export class RequisiteProvider extends Entity<string> {
  private readonly snapshot: RequisiteProviderSnapshot;

  private constructor(snapshot: RequisiteProviderSnapshot) {
    super(snapshot.id);
    this.snapshot = normalizeRequisiteProviderSnapshot(snapshot);
  }

  static create(input: CreateRequisiteProviderProps): RequisiteProvider {
    return new RequisiteProvider({
      id: input.id,
      ...normalizeDetails(input),
      archivedAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static fromSnapshot(snapshot: RequisiteProviderSnapshot): RequisiteProvider {
    return new RequisiteProvider({ ...snapshot });
  }

  update(input: UpdateRequisiteProviderPatch): RequisiteProvider {
    const { now, ...patch } = input;
    const next = applyPatch<RequisiteProviderSnapshot>(
      this.snapshot,
      patch as Partial<RequisiteProviderSnapshot>,
    );

    return new RequisiteProvider({
      ...next,
      ...normalizeDetails(next),
      updatedAt: now,
    });
  }

  archive(now: Date): RequisiteProvider {
    return new RequisiteProvider({
      ...this.snapshot,
      archivedAt: this.snapshot.archivedAt ?? now,
      updatedAt: now,
    });
  }

  toSnapshot(): RequisiteProviderSnapshot {
    return { ...this.snapshot };
  }
}

export interface CreateRequisiteProviderProps extends RequisiteProviderDetails {
  id: string;
  now: Date;
}

export interface UpdateRequisiteProviderProps extends RequisiteProviderDetails {
  now: Date;
}

export interface UpdateRequisiteProviderPatch
  extends Partial<RequisiteProviderDetails> {
  now: Date;
}
