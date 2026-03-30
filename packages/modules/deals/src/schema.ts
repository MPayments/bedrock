import {
  dealApprovalStatusEnum,
  dealApprovalTypeEnum,
  dealApprovals,
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
  dealTypeEnum,
  dealStatusEnum,
  dealLegKindEnum,
  dealParticipantRoleEnum,
  dealApprovalTypeEnum,
  dealApprovalStatusEnum,
};
