import { ExecutionPlanCard } from "./execution-plan-card";
import { OperationalStateCard } from "./operational-state-card";
import type {
  ApiDealOperationalState,
  ApiDealSectionCompleteness,
  ApiDealTransitionReadiness,
  ApiDealWorkflowLeg,
} from "./types";

type DealExecutionTabProps = {
  executionPlan: ApiDealWorkflowLeg[];
  operationalState: ApiDealOperationalState;
  sectionCompleteness: ApiDealSectionCompleteness[];
  transitionReadiness: ApiDealTransitionReadiness[];
};

export function DealExecutionTab({
  executionPlan,
  operationalState,
  sectionCompleteness,
  transitionReadiness,
}: DealExecutionTabProps) {
  return (
    <div className="space-y-6">
      <ExecutionPlanCard
        executionPlan={executionPlan}
        sectionCompleteness={sectionCompleteness}
        transitionReadiness={transitionReadiness}
      />
      <OperationalStateCard operationalState={operationalState} />
    </div>
  );
}
