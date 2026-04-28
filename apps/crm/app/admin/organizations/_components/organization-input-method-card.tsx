"use client";

import {
  OrganizationInputMethodCard as BaseOrganizationInputMethodCard,
  type OrganizationInputMethod,
  type OrganizationInputMethodCardProps as BaseOrganizationInputMethodCardProps,
  type OrganizationPrefillPatch,
} from "@bedrock/sdk-parties-ui/components/organization-input-method-card";

import {
  lookupOrganizationByInn,
  parseOrganizationCardPdf,
} from "@bedrock/sdk-parties-ui/lib/organization-prefill";

export type { OrganizationInputMethod, OrganizationPrefillPatch };

type OrganizationInputMethodCardProps = Omit<
  BaseOrganizationInputMethodCardProps,
  "lookupOrganizationByInn" | "parseOrganizationCardPdf"
>;

export function OrganizationInputMethodCard(
  props: OrganizationInputMethodCardProps,
) {
  return (
    <BaseOrganizationInputMethodCard
      {...props}
      lookupOrganizationByInn={lookupOrganizationByInn}
      parseOrganizationCardPdf={parseOrganizationCardPdf}
    />
  );
}
