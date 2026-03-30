import {
  dealApprovalStatusEnum,
  dealApprovalTypeEnum,
  dealApprovals,
  dealCalculationLinks,
  dealLegKindEnum,
  dealLegs,
  dealParticipantRoleEnum,
  dealParticipants,
  deals,
  dealStatusEnum,
  dealStatusHistory,
  dealTypeEnum,
} from "./adapters/drizzle/schema";

export {
  dealApprovalStatusEnum,
  dealApprovalTypeEnum,
  dealApprovals,
  dealCalculationLinks,
  dealLegKindEnum,
  dealLegs,
  dealParticipantRoleEnum,
  dealParticipants,
  deals,
  dealStatusEnum,
  dealStatusHistory,
  dealTypeEnum,
};

export const schema = {
  deals,
  dealLegs,
  dealParticipants,
  dealStatusHistory,
  dealApprovals,
  dealCalculationLinks,
  dealTypeEnum,
  dealStatusEnum,
  dealLegKindEnum,
  dealParticipantRoleEnum,
  dealApprovalTypeEnum,
  dealApprovalStatusEnum,
};
