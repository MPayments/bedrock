"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE_URL } from "@/lib/constants";

import { decimalToMinorString } from "./format";
import type {
  ApiDealFundingAdjustment,
  ApiDealPricingContext,
  ApiDealPricingPreview,
} from "./types";

type DealPricingCommercialDraftState = {
  clientPricing: ApiDealPricingContext["commercialDraft"]["clientPricing"];
  executionSource: ApiDealPricingContext["commercialDraft"]["executionSource"];
  fixedFeeAmount: string | null;
  fixedFeeCurrency: string | null;
  quoteMarkupBps: number | null;
};

type UseDealPricingAutoSyncParams = {
  amountInput: string;
  amountInputPrecision: number;
  amountSide: "source" | "target";
  asOfInput: string;
  commercialDraft: DealPricingCommercialDraftState;
  dealId: string;
  fundingAdjustments: ApiDealFundingAdjustment[];
  quoteCreationDisabledReason: string | null;
  routeAttachmentKey: string;
  serverContext: ApiDealPricingContext;
  onContextSynced: (context: ApiDealPricingContext) => void;
};

type SyncResult = {
  context: ApiDealPricingContext;
  preview: ApiDealPricingPreview;
};

type UseDealPricingAutoSyncResult = {
  autoSyncError: string | null;
  flushSync: () => Promise<SyncResult | null>;
  isAutoSyncing: boolean;
  lastSyncedAt: string | null;
  preview: ApiDealPricingPreview | null;
  requestImmediateSync: () => void;
  retrySync: () => void;
  setPreview: (preview: ApiDealPricingPreview | null) => void;
};

type LatestInputs = Omit<UseDealPricingAutoSyncParams, "onContextSynced">;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  if (!response.ok) {
    let message = `Ошибка запроса: ${response.status}`;

    try {
      const payload = (await response.json()) as {
        error?: string;
        message?: string;
      };
      message = payload.message ?? payload.error ?? message;
    } catch {
      // Ignore JSON parsing issues.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

function normalizeOptionalDecimalInput(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = value.trim().replace(",", ".");
  return normalized.length > 0 ? normalized : null;
}

function cloneCommercialDraft(context: ApiDealPricingContext) {
  return {
    clientPricing: context.commercialDraft.clientPricing ?? null,
    executionSource: context.commercialDraft.executionSource ?? {
      type: "route_execution",
    },
    fixedFeeAmount: context.commercialDraft.fixedFeeAmount ?? null,
    fixedFeeCurrency: context.commercialDraft.fixedFeeCurrency ?? null,
    quoteMarkupBps: context.commercialDraft.quoteMarkupBps ?? null,
  };
}

function cloneFundingAdjustments(context: ApiDealPricingContext) {
  return context.fundingAdjustments.map((adjustment) => ({
    ...adjustment,
  }));
}

function areSameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useDealPricingAutoSync({
  amountInput,
  amountInputPrecision,
  amountSide,
  asOfInput,
  commercialDraft,
  dealId,
  fundingAdjustments,
  quoteCreationDisabledReason,
  routeAttachmentKey,
  serverContext,
  onContextSynced,
}: UseDealPricingAutoSyncParams): UseDealPricingAutoSyncResult {
  const [preview, setPreview] = useState<ApiDealPricingPreview | null>(null);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const [autoSyncError, setAutoSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const latestInputs = useMemo<LatestInputs>(
    () => ({
      amountInput,
      amountInputPrecision,
      amountSide,
      asOfInput,
      commercialDraft,
      dealId,
      fundingAdjustments,
      quoteCreationDisabledReason,
      routeAttachmentKey,
      serverContext,
    }),
    [
      amountInput,
      amountInputPrecision,
      amountSide,
      asOfInput,
      commercialDraft,
      dealId,
      fundingAdjustments,
      quoteCreationDisabledReason,
      routeAttachmentKey,
      serverContext,
    ],
  );

  const latestInputsRef = useRef(latestInputs);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const rerunRequestedRef = useRef(false);
  const currentRunPromiseRef = useRef<Promise<SyncResult | null> | null>(null);

  useEffect(() => {
    latestInputsRef.current = latestInputs;
  }, [latestInputs]);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const syncCurrentDraft = useCallback(async (): Promise<SyncResult | null> => {
    const current = latestInputsRef.current;
    let nextContext = current.serverContext;

    if (!nextContext.routeAttachment) {
      const initialized = await fetchJson<ApiDealPricingContext>(
        `${API_BASE_URL}/deals/${current.dealId}/pricing/initialize-route`,
        {
          method: "POST",
        },
      );

      if (initialized.revision !== nextContext.revision) {
        nextContext = initialized;
        latestInputsRef.current = {
          ...latestInputsRef.current,
          serverContext: nextContext,
        };
        onContextSynced(nextContext);
      }
    }

    const hasCommercialChanges = !areSameJson(
      current.commercialDraft,
      cloneCommercialDraft(nextContext),
    );
    const hasFundingChanges = !areSameJson(
      current.fundingAdjustments,
      cloneFundingAdjustments(nextContext),
    );

    if (hasCommercialChanges || hasFundingChanges) {
      const body: {
        commercialDraft?: DealPricingCommercialDraftState;
        expectedRevision: number;
        fundingAdjustments?: ApiDealFundingAdjustment[];
      } = {
        expectedRevision: nextContext.revision,
      };

      if (hasCommercialChanges) {
        body.commercialDraft = {
          fixedFeeAmount: normalizeOptionalDecimalInput(
            current.commercialDraft.fixedFeeAmount,
          ),
          clientPricing: current.commercialDraft.clientPricing,
          executionSource: current.commercialDraft.executionSource,
          fixedFeeCurrency: current.commercialDraft.fixedFeeCurrency,
          quoteMarkupBps: current.commercialDraft.quoteMarkupBps,
        };
      }

      if (hasFundingChanges) {
        body.fundingAdjustments = current.fundingAdjustments;
      }

      nextContext = await fetchJson<ApiDealPricingContext>(
        `${API_BASE_URL}/deals/${current.dealId}/pricing/context`,
        {
          body: JSON.stringify(body),
          headers: {
            "Content-Type": "application/json",
          },
          method: "PATCH",
        },
      );

      latestInputsRef.current = {
        ...latestInputsRef.current,
        serverContext: nextContext,
      };
      onContextSynced(nextContext);
    }

    const amountMinor = decimalToMinorString(
      current.amountInput,
      current.amountInputPrecision,
    );
    const asOfDate = new Date(current.asOfInput);

    if (
      !amountMinor ||
      amountMinor === "0" ||
      Number.isNaN(asOfDate.getTime()) ||
      current.quoteCreationDisabledReason
    ) {
      setPreview(null);
      setAutoSyncError(null);
      return null;
    }

    setAutoSyncError(null);

    const nextPreview = await fetchJson<ApiDealPricingPreview>(
      `${API_BASE_URL}/deals/${current.dealId}/pricing/preview`,
      {
        body: JSON.stringify({
          amountMinor,
          amountSide: current.amountSide,
          asOf: asOfDate.toISOString(),
          expectedRevision: nextContext.revision,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      },
    );

    setPreview(nextPreview);
    setLastSyncedAt(new Date().toISOString());

    return {
      context: nextContext,
      preview: nextPreview,
    };
  }, [onContextSynced]);

  const runSyncLoop = useCallback(async (): Promise<SyncResult | null> => {
    clearDebounceTimer();

    if (runningRef.current) {
      rerunRequestedRef.current = true;
      return currentRunPromiseRef.current;
    }

    runningRef.current = true;
    setIsAutoSyncing(true);

    const runPromise = (async () => {
      let result: SyncResult | null = null;

      do {
        rerunRequestedRef.current = false;

        try {
          result = await syncCurrentDraft();
        } catch (error) {
          setAutoSyncError(
            error instanceof Error
              ? error.message
              : "Не удалось обновить расчет.",
          );

          if (!rerunRequestedRef.current) {
            throw error;
          }
        }
      } while (rerunRequestedRef.current);

      return result;
    })()
      .finally(() => {
        runningRef.current = false;
        currentRunPromiseRef.current = null;
        setIsAutoSyncing(false);
      });

    currentRunPromiseRef.current = runPromise;
    return runPromise;
  }, [clearDebounceTimer, syncCurrentDraft]);

  const scheduleDebouncedSync = useCallback(() => {
    clearDebounceTimer();
    debounceTimerRef.current = setTimeout(() => {
      void runSyncLoop().catch(() => {
        // Inline error state is already populated.
      });
    }, 450);
  }, [clearDebounceTimer, runSyncLoop]);

  useEffect(() => {
    scheduleDebouncedSync();

    return clearDebounceTimer;
  }, [
    amountInput,
    amountInputPrecision,
    amountSide,
    asOfInput,
    clearDebounceTimer,
    commercialDraft,
    fundingAdjustments,
    quoteCreationDisabledReason,
    routeAttachmentKey,
    scheduleDebouncedSync,
  ]);

  const requestImmediateSync = useCallback(() => {
    void runSyncLoop().catch(() => {
      // Inline error state is already populated.
    });
  }, [runSyncLoop]);

  const retrySync = useCallback(() => {
    setAutoSyncError(null);
    void runSyncLoop().catch(() => {
      // Inline error state is already populated.
    });
  }, [runSyncLoop]);

  const flushSync = useCallback(async () => {
    return runSyncLoop();
  }, [runSyncLoop]);

  useEffect(
    () => () => {
      clearDebounceTimer();
    },
    [clearDebounceTimer],
  );

  return {
    autoSyncError,
    flushSync,
    isAutoSyncing,
    lastSyncedAt,
    preview,
    requestImmediateSync,
    retrySync,
    setPreview,
  };
}
