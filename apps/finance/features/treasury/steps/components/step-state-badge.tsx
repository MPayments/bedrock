"use client";

import { Badge } from "@bedrock/sdk-ui/components/badge";

import {
  STEP_STATE_LABELS,
  stepBadgeVariant,
  type StepState,
} from "../lib/step-helpers";

export interface StepStateBadgeProps {
  state: StepState;
  "data-testid"?: string;
}

export function StepStateBadge({
  state,
  "data-testid": testId,
}: StepStateBadgeProps) {
  return (
    <Badge data-testid={testId} variant={stepBadgeVariant(state)}>
      {STEP_STATE_LABELS[state]}
    </Badge>
  );
}
