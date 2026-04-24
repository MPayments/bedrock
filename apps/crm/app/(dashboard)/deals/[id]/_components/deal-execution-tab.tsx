import { ExecutionPlanCard } from "./execution-plan-card";
import { OperationalStateCard } from "./operational-state-card";
import type {
  ApiDealOperationalState,
  ApiDealSectionCompleteness,
  ApiDealTransitionReadiness,
  ApiDealWorkflowLeg,
  DealLegManualOverride,
  DealStatus,
} from "./types";

type DealExecutionTabProps = {
  executionPlan: ApiDealWorkflowLeg[];
  isUpdatingLegKey: string | null;
  onBlockedTransitionClick: (status: DealStatus) => void;
  onOverrideLeg: (idx: number, override: DealLegManualOverride) => void;
  operationalState: ApiDealOperationalState;
  sectionCompleteness: ApiDealSectionCompleteness[];
  transitionReadiness: ApiDealTransitionReadiness[];
};

export function DealExecutionTab({
  executionPlan,
  isUpdatingLegKey,
  onBlockedTransitionClick,
  onOverrideLeg,
  operationalState,
  sectionCompleteness,
  transitionReadiness,
}: DealExecutionTabProps) {
  return (
    <div className="space-y-6">
      <ExecutionPlanCard
        executionPlan={executionPlan}
        isUpdatingLegKey={isUpdatingLegKey}
        onBlockedTransitionClick={onBlockedTransitionClick}
        onOverrideLeg={onOverrideLeg}
        sectionCompleteness={sectionCompleteness}
        transitionReadiness={transitionReadiness}
      />
      <OperationalStateCard operationalState={operationalState} />
    </div>
  );
}
