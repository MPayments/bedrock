import { z } from "zod";

import type { CreateOrganizationInput } from "@bedrock/parties/contracts";
import type { PartyProfileBundleSource } from "@bedrock/sdk-parties-ui/lib/party-profile";

import { apiClient } from "@/lib/api-client";
import { API_BASE_URL } from "@/lib/constants";
import {
  parseJsonSafely,
  readJsonWithSchema,
  type HttpResponseLike,
} from "@/lib/api/response";

export const ORGANIZATION_WORKSPACE_TABS = [
  "organization",
  "requisites",
  "files",
] as const;

export type OrganizationWorkspaceTab =
  (typeof ORGANIZATION_WORKSPACE_TABS)[number];

export const OrganizationWorkspaceSchema = z.object({
  id: z.uuid(),
  shortName: z.string(),
  fullName: z.string(),
  externalRef: z.string().nullable(),
  description: z.string().nullable(),
  country: z.string().nullable(),
  kind: z.enum(["legal_entity", "individual"]),
  isActive: z.boolean(),
  signatureKey: z.string().nullable(),
  sealKey: z.string().nullable(),
  signatureUrl: z.string().nullable(),
  sealUrl: z.string().nullable(),
  hasFiles: z.boolean(),
  banksCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  partyProfile: z.custom<PartyProfileBundleSource | null>().nullable(),
});

export type OrganizationWorkspaceRecord = z.infer<
  typeof OrganizationWorkspaceSchema
>;

const CreatedOrganizationSchema = z.object({
  id: z.uuid(),
});

async function resolveErrorMessage(
  response: HttpResponseLike,
  fallbackMessage: string,
) {
  const payload = await parseJsonSafely(response);
  if (payload && typeof payload === "object") {
    const error =
      "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "message" in payload && typeof payload.message === "string"
          ? payload.message
          : null;

    if (error) {
      return error;
    }
  }

  if (response.status === 404) {
    return "Ресурс не найден";
  }

  return fallbackMessage;
}

export function buildOrganizationWorkspaceHref(input: {
  organizationId: string;
  requisiteId?: string | null;
  tab?: OrganizationWorkspaceTab;
}) {
  const params = new URLSearchParams();
  params.set("tab", input.tab ?? "organization");

  if (input.requisiteId) {
    params.set("requisite", input.requisiteId);
  }

  return `/admin/organizations/${input.organizationId}?${params.toString()}`;
}

export function normalizeOrganizationWorkspaceTab(
  value: string | null,
): OrganizationWorkspaceTab {
  if (
    value === "organization" ||
    value === "requisites" ||
    value === "files"
  ) {
    return value;
  }

  return "organization";
}

export async function getOrganizationWorkspace(
  organizationId: string,
): Promise<OrganizationWorkspaceRecord> {
  const response = await apiClient.v1.organizations[":id"].$get({
    param: { id: organizationId },
  });

  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "Организация не найдена"
        : await resolveErrorMessage(
            response,
            "Не удалось загрузить организацию",
          ),
    );
  }

  return readJsonWithSchema(response, OrganizationWorkspaceSchema);
}

export async function createOrganizationWorkspace(
  input: CreateOrganizationInput,
) {
  const response = await apiClient.v1.organizations.$post({
    json: input,
  });

  if (!response.ok) {
    throw new Error(
      await resolveErrorMessage(response, "Не удалось создать организацию"),
    );
  }

  return readJsonWithSchema(response, CreatedOrganizationSchema);
}

export async function uploadOrganizationWorkspaceFiles(input: {
  organizationId: string;
  signature?: Blob | null;
  seal?: Blob | null;
}) {
  const formData = new FormData();

  if (input.signature) {
    formData.set("signature", input.signature, "signature.png");
  }

  if (input.seal) {
    formData.set("seal", input.seal, "seal.png");
  }

  if (Array.from(formData.keys()).length === 0) {
    return;
  }

  const response = await fetch(
    `${API_BASE_URL}/organizations/${input.organizationId}/files`,
    {
      method: "POST",
      body: formData,
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(
      await resolveErrorMessage(
        response,
        "Не удалось загрузить файлы организации",
      ),
    );
  }
}
