import { z } from "zod";

import {
  DEAL_ATTACHMENT_INGESTION_STATUS_VALUES,
  DEAL_APPROVAL_STATUS_VALUES,
  DEAL_APPROVAL_TYPE_VALUES,
  DEAL_TRANSITION_BLOCKER_CODE_VALUES,
  DEAL_LEG_OPERATION_KIND_VALUES,
  DEAL_LEG_STATE_VALUES,
  DEAL_LEG_KIND_VALUES,
  DEAL_LEGACY_PARTICIPANT_ROLE_VALUES,
  DEAL_OPERATIONAL_POSITION_KIND_VALUES,
  DEAL_OPERATIONAL_POSITION_STATE_VALUES,
  DEAL_PARTICIPANT_ROLE_VALUES,
  DEAL_SECTION_ID_VALUES,
  DEAL_STATUS_VALUES,
  DEAL_TIMELINE_EVENT_TYPE_VALUES,
  DEAL_TIMELINE_VISIBILITY_VALUES,
  DEAL_TYPE_VALUES,
} from "../../domain/constants";

export const DealTypeSchema = z.enum(DEAL_TYPE_VALUES);

export const DealStatusSchema = z.enum(DEAL_STATUS_VALUES);

export const DealLegKindSchema = z.enum(DEAL_LEG_KIND_VALUES);

export const DealLegStateSchema = z.enum(DEAL_LEG_STATE_VALUES);

export const DealLegOperationKindSchema = z.enum(
  DEAL_LEG_OPERATION_KIND_VALUES,
);

export const DealAttachmentIngestionStatusSchema = z.enum(
  DEAL_ATTACHMENT_INGESTION_STATUS_VALUES,
);

export const DealOperationalPositionKindSchema = z.enum(
  DEAL_OPERATIONAL_POSITION_KIND_VALUES,
);

export const DealOperationalPositionStateSchema = z.enum(
  DEAL_OPERATIONAL_POSITION_STATE_VALUES,
);

export const DealParticipantRoleSchema = z.enum(DEAL_PARTICIPANT_ROLE_VALUES);

export const LegacyDealParticipantRoleSchema = z.enum(
  DEAL_LEGACY_PARTICIPANT_ROLE_VALUES,
);

export const DealSectionIdSchema = z.enum(DEAL_SECTION_ID_VALUES);

export const DealTimelineEventTypeSchema = z.enum(
  DEAL_TIMELINE_EVENT_TYPE_VALUES,
);

export const DealTimelineVisibilitySchema = z.enum(
  DEAL_TIMELINE_VISIBILITY_VALUES,
);

export const DealApprovalTypeSchema = z.enum(DEAL_APPROVAL_TYPE_VALUES);

export const DealApprovalStatusSchema = z.enum(DEAL_APPROVAL_STATUS_VALUES);

export const DealTransitionBlockerCodeSchema = z.enum(
  DEAL_TRANSITION_BLOCKER_CODE_VALUES,
);

export type {
  DealApprovalStatus,
  DealApprovalType,
  DealAttachmentIngestionStatus,
  DealLegKind,
  DealLegOperationKind,
  DealLegState,
  DealOperationalPositionKind,
  DealOperationalPositionState,
  DealParticipantRole,
  DealSectionId,
  DealStatus,
  DealTimelineEventType,
  DealTimelineVisibility,
  DealTransitionBlockerCode,
  DealType,
  LegacyDealParticipantRole,
} from "../../domain/model";
