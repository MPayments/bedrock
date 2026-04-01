import { z } from "zod";

import {
  DEAL_APPROVAL_STATUS_VALUES,
  DEAL_APPROVAL_TYPE_VALUES,
  DEAL_CAPABILITY_KIND_VALUES,
  DEAL_CAPABILITY_STATUS_VALUES,
  DEAL_TRANSITION_BLOCKER_CODE_VALUES,
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
export type DealType = z.infer<typeof DealTypeSchema>;

export const DealStatusSchema = z.enum(DEAL_STATUS_VALUES);
export type DealStatus = z.infer<typeof DealStatusSchema>;

export const DealLegKindSchema = z.enum(DEAL_LEG_KIND_VALUES);
export type DealLegKind = z.infer<typeof DealLegKindSchema>;

export const DealLegStateSchema = z.enum(DEAL_LEG_STATE_VALUES);
export type DealLegState = z.infer<typeof DealLegStateSchema>;

export const DealCapabilityKindSchema = z.enum(DEAL_CAPABILITY_KIND_VALUES);
export type DealCapabilityKind = z.infer<typeof DealCapabilityKindSchema>;

export const DealCapabilityStatusSchema = z.enum(DEAL_CAPABILITY_STATUS_VALUES);
export type DealCapabilityStatus = z.infer<typeof DealCapabilityStatusSchema>;

export const DealOperationalPositionKindSchema = z.enum(
  DEAL_OPERATIONAL_POSITION_KIND_VALUES,
);
export type DealOperationalPositionKind = z.infer<
  typeof DealOperationalPositionKindSchema
>;

export const DealOperationalPositionStateSchema = z.enum(
  DEAL_OPERATIONAL_POSITION_STATE_VALUES,
);
export type DealOperationalPositionState = z.infer<
  typeof DealOperationalPositionStateSchema
>;

export const DealParticipantRoleSchema = z.enum(DEAL_PARTICIPANT_ROLE_VALUES);
export type DealParticipantRole = z.infer<typeof DealParticipantRoleSchema>;

export const LegacyDealParticipantRoleSchema = z.enum(
  DEAL_LEGACY_PARTICIPANT_ROLE_VALUES,
);
export type LegacyDealParticipantRole = z.infer<
  typeof LegacyDealParticipantRoleSchema
>;

export const DealSectionIdSchema = z.enum(DEAL_SECTION_ID_VALUES);
export type DealSectionId = z.infer<typeof DealSectionIdSchema>;

export const DealTimelineEventTypeSchema = z.enum(
  DEAL_TIMELINE_EVENT_TYPE_VALUES,
);
export type DealTimelineEventType = z.infer<typeof DealTimelineEventTypeSchema>;

export const DealTimelineVisibilitySchema = z.enum(
  DEAL_TIMELINE_VISIBILITY_VALUES,
);
export type DealTimelineVisibility = z.infer<
  typeof DealTimelineVisibilitySchema
>;

export const DealApprovalTypeSchema = z.enum(DEAL_APPROVAL_TYPE_VALUES);
export type DealApprovalType = z.infer<typeof DealApprovalTypeSchema>;

export const DealApprovalStatusSchema = z.enum(DEAL_APPROVAL_STATUS_VALUES);
export type DealApprovalStatus = z.infer<typeof DealApprovalStatusSchema>;

export const DealTransitionBlockerCodeSchema = z.enum(
  DEAL_TRANSITION_BLOCKER_CODE_VALUES,
);
export type DealTransitionBlockerCode = z.infer<
  typeof DealTransitionBlockerCodeSchema
>;
