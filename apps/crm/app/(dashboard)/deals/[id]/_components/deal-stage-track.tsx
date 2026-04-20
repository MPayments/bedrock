"use client";

import * as React from "react";
import { Check, Info, Lock } from "lucide-react";

import type { DealStatus } from "./types";

export type DealStageKey =
  | "pricing"
  | "calculating"
  | "approval"
  | "funding"
  | "settled";

export const DEAL_STAGE_ORDER: DealStageKey[] = [
  "pricing",
  "calculating",
  "approval",
  "funding",
  "settled",
];

export const DEAL_STAGE_LABEL: Record<DealStageKey, string> = {
  pricing: "Прайсинг",
  calculating: "Расчёт",
  approval: "Согласование",
  funding: "Исполнение",
  settled: "Завершено",
};

const STATUS_TO_STAGE_INDEX: Record<DealStatus, number> = {
  draft: 0,
  submitted: 1,
  preparing_documents: 2,
  awaiting_funds: 3,
  awaiting_payment: 3,
  closing_documents: 3,
  done: 4,
  rejected: 4,
  cancelled: 4,
};

export function currentStageIndexFromStatus(status: DealStatus): number {
  return STATUS_TO_STAGE_INDEX[status] ?? 0;
}

export function isTerminalBad(status: DealStatus): boolean {
  return status === "rejected" || status === "cancelled";
}

type StageMeta = {
  done: boolean;
  active: boolean;
  current: boolean;
  pending: boolean;
  note: string;
};

function computeStageMetas(
  currentIdx: number,
  viewIdx: number,
  status: DealStatus,
): StageMeta[] {
  const bad = isTerminalBad(status);
  return DEAL_STAGE_ORDER.map((_key, i) => {
    const active = i === viewIdx;
    const done = i < currentIdx;
    const current = i === currentIdx;
    const pending = i > currentIdx;

    let note: string;
    if (done) {
      note = "Выполнено";
    } else if (current) {
      if (bad) {
        note = status === "rejected" ? "Отклонено" : "Отменено";
      } else {
        note = "В работе";
      }
    } else {
      note = "Ожидает";
    }

    return { done, active, current, pending, note };
  });
}

type DealStageTrackProps = {
  status: DealStatus;
  viewStage: DealStageKey;
  onViewStageChange: (stage: DealStageKey) => void;
};

export function DealStageTrack({
  status,
  viewStage,
  onViewStageChange,
}: DealStageTrackProps) {
  const currentIdx = currentStageIndexFromStatus(status);
  const viewIdx = DEAL_STAGE_ORDER.indexOf(viewStage);
  const metas = computeStageMetas(currentIdx, viewIdx, status);
  const bad = isTerminalBad(status);

  return (
    <div className="stage-track" role="tablist" aria-label="Этапы сделки">
      {DEAL_STAGE_ORDER.map((key, i) => {
        const meta = metas[i];
        if (!meta) return null;
        const className = [
          "stage-tab",
          meta.active && "active",
          meta.done && "done",
          meta.current && "current",
          meta.pending && "pending",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <React.Fragment key={key}>
            <button
              type="button"
              role="tab"
              aria-selected={meta.active}
              className={className}
              data-testid={`deal-stage-${key}`}
              onClick={() => onViewStageChange(key)}
            >
              <span className="stage-tab-num">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="stage-tab-body">
                <span className="stage-tab-label block">
                  {DEAL_STAGE_LABEL[key]}
                </span>
                <span className="stage-tab-note block">{meta.note}</span>
              </span>
              <span className="stage-tab-state">
                {meta.done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : meta.current ? (
                  bad ? (
                    <Info className="h-3.5 w-3.5 text-destructive" />
                  ) : (
                    <span className="stage-tab-pulse" />
                  )
                ) : (
                  <Lock className="h-3 w-3" />
                )}
              </span>
            </button>
            {i < DEAL_STAGE_ORDER.length - 1 ? (
              <div
                className={`stage-track-sep${meta.done ? " done" : ""}`}
                aria-hidden
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

type StageViewingBannerProps = {
  viewStage: DealStageKey;
  currentStage: DealStageKey;
  onJumpToCurrent: () => void;
};

export function StageViewingBanner({
  viewStage,
  currentStage,
  onJumpToCurrent,
}: StageViewingBannerProps) {
  if (viewStage === currentStage) return null;

  const viewIdx = DEAL_STAGE_ORDER.indexOf(viewStage);
  const currentIdx = DEAL_STAGE_ORDER.indexOf(currentStage);
  const isPast = viewIdx < currentIdx;

  return (
    <div className="stage-viewing-banner" role="status">
      <Info className="h-3.5 w-3.5 text-amber-600" />
      <span>
        Просмотр этапа «<b>{DEAL_STAGE_LABEL[viewStage]}</b>» (
        {isPast ? "пройден ранее" : "ещё не достигнут"}). Текущий этап —{" "}
        <b>{DEAL_STAGE_LABEL[currentStage]}</b>.
      </span>
      <button
        type="button"
        className="link-btn"
        onClick={onJumpToCurrent}
      >
        Перейти к текущему →
      </button>
    </div>
  );
}
