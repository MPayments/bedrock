import { z } from "zod";

import {
  DEAL_APPROVAL_STATUS_VALUES,
  DEAL_APPROVAL_TYPE_VALUES,
  DEAL_LEG_KIND_VALUES,
  DEAL_PARTICIPANT_ROLE_VALUES,
  DEAL_STATUS_VALUES,
  DEAL_TYPE_VALUES,
} from "../../domain/constants";

export const DealTypeSchema = z.enum(DEAL_TYPE_VALUES);
export type DealType = z.infer<typeof DealTypeSchema>;

export const DealStatusSchema = z.enum(DEAL_STATUS_VALUES);
export type DealStatus = z.infer<typeof DealStatusSchema>;

export const DealLegKindSchema = z.enum(DEAL_LEG_KIND_VALUES);
export type DealLegKind = z.infer<typeof DealLegKindSchema>;

export const DealParticipantRoleSchema = z.enum(DEAL_PARTICIPANT_ROLE_VALUES);
export type DealParticipantRole = z.infer<typeof DealParticipantRoleSchema>;

export const DealApprovalTypeSchema = z.enum(DEAL_APPROVAL_TYPE_VALUES);
export type DealApprovalType = z.infer<typeof DealApprovalTypeSchema>;

export const DealApprovalStatusSchema = z.enum(DEAL_APPROVAL_STATUS_VALUES);
export type DealApprovalStatus = z.infer<typeof DealApprovalStatusSchema>;
