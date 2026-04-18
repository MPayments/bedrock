"use client";

import * as React from "react";
import { z } from "zod";

import { readJsonWithSchema, requestOk } from "@/lib/api/response";

import type { PaymentRouteDraft } from "@bedrock/calculations/contracts";

import {
  getPaymentRouteParticipantOwnerKey,
  mapPaymentRouteOwnerRequisite,
  type PaymentRouteOwnerRequisitesByKey,
  type PaymentRouteOwnerRequisitesStatus,
} from "./requisites";
import type { PaymentRouteConstructorOptions } from "./queries";

const RawRequisiteSchema = z.object({
  beneficiaryName: z.string().nullable(),
  currencyId: z.uuid(),
  id: z.uuid(),
  identifiers: z
    .array(
      z.object({
        isPrimary: z.boolean(),
        scheme: z.string(),
        value: z.string(),
      }),
    )
    .default([]),
  isDefault: z.boolean(),
  kind: z.enum(["bank", "blockchain", "custodian", "exchange"]),
  label: z.string(),
  ownerId: z.uuid(),
  ownerType: z.enum(["counterparty", "organization"]),
});

const OwnerRequisitesResponseSchema = z.object({
  data: z.array(RawRequisiteSchema),
});

type PaymentRouteRequisiteOwner = {
  key: string;
  ownerId: string;
  ownerType: "counterparty" | "organization";
};

function getOwners(draft: PaymentRouteDraft) {
  const seen = new Set<string>();
  const owners: PaymentRouteRequisiteOwner[] = [];

  draft.participants.forEach((participant) => {
    const key = getPaymentRouteParticipantOwnerKey(participant);

    if (
      !key ||
      seen.has(key) ||
      participant.binding !== "bound" ||
      (participant.entityKind !== "organization" &&
        participant.entityKind !== "counterparty")
    ) {
      return;
    }

    seen.add(key);
    owners.push({
      key,
      ownerId: participant.entityId,
      ownerType: participant.entityKind,
    });
  });

  return owners;
}

function getPath(owner: PaymentRouteRequisiteOwner) {
  const basePath =
    owner.ownerType === "organization"
      ? `/v1/organizations/${encodeURIComponent(owner.ownerId)}/requisites`
      : `/v1/counterparties/${encodeURIComponent(owner.ownerId)}/requisites`;

  return `${basePath}?limit=100&offset=0&sortBy=createdAt&sortOrder=desc`;
}

export function usePaymentRouteRequisites(input: {
  draft: PaymentRouteDraft | null;
  options: PaymentRouteConstructorOptions;
}) {
  const owners = React.useMemo(
    () => (input.draft ? getOwners(input.draft) : []),
    [input.draft],
  );
  const [requisitesByOwner, setRequisitesByOwner] =
    React.useState<PaymentRouteOwnerRequisitesByKey>({});
  const [statusByOwner, setStatusByOwner] =
    React.useState<PaymentRouteOwnerRequisitesStatus>({});

  const fetchOwner = React.useEffectEvent(async (owner: PaymentRouteRequisiteOwner) => {
    setStatusByOwner((current) => ({
      ...current,
      [owner.key]: {
        error: null,
        pending: true,
      },
    }));

    try {
      const response = await requestOk(
        await fetch(getPath(owner), {
          cache: "no-store",
          credentials: "include",
        }),
        "Не удалось загрузить реквизиты участника маршрута",
      );
      const payload = await readJsonWithSchema(
        response,
        OwnerRequisitesResponseSchema,
      );

      setRequisitesByOwner((current) => ({
        ...current,
        [owner.key]: payload.data.map((row) =>
          mapPaymentRouteOwnerRequisite({
            beneficiaryName: row.beneficiaryName,
            currencyCode:
              input.options.currencies.find(
                (currency) => currency.id === row.currencyId,
              )?.code ?? row.currencyId,
            currencyId: row.currencyId,
            id: row.id,
            identifiers: row.identifiers,
            isDefault: row.isDefault,
            kind: row.kind,
            label: row.label,
            ownerId: row.ownerId,
            ownerType: row.ownerType,
          }),
        ),
      }));
      setStatusByOwner((current) => ({
        ...current,
        [owner.key]: {
          error: null,
          pending: false,
        },
      }));
    } catch (error) {
      setStatusByOwner((current) => ({
        ...current,
        [owner.key]: {
          error:
            error instanceof Error && error.message
              ? error.message
              : "Не удалось загрузить реквизиты участника маршрута",
          pending: false,
        },
      }));
    }
  });

  React.useEffect(() => {
    owners.forEach((owner) => {
      const ownerStatus = statusByOwner[owner.key];

      if (ownerStatus?.pending || ownerStatus) {
        return;
      }

      void fetchOwner(owner);
    });
  }, [fetchOwner, owners, statusByOwner]);

  React.useEffect(() => {
    function handleFocus() {
      owners.forEach((owner) => {
        void fetchOwner(owner);
      });
    }

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchOwner, owners]);

  return {
    refreshOwner: (ownerKey: string) => {
      const owner = owners.find((candidate) => candidate.key === ownerKey);

      if (owner) {
        void fetchOwner(owner);
      }
    },
    refreshVisibleOwners: () => {
      owners.forEach((owner) => {
        void fetchOwner(owner);
      });
    },
    requisitesByOwner,
    statusByOwner,
  };
}

export type PaymentRouteRequisitesState = ReturnType<
  typeof usePaymentRouteRequisites
>;
