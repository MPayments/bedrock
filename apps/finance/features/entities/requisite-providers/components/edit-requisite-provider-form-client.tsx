"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { RequisiteProviderMasterDataEditor } from "@bedrock/sdk-parties-ui/components/requisite-provider-master-data-editor";
import { type RequisiteProviderMasterDataInput } from "@bedrock/sdk-parties-ui/lib/requisite-provider-master-data";
import { Button } from "@bedrock/sdk-ui/components/button";
import { toast } from "@bedrock/sdk-ui/components/sonner";

import { apiClient } from "@/lib/api-client";
import { executeMutation } from "@/lib/resources/http";

import type { RequisiteProviderDetails } from "../lib/queries";

type EditRequisiteProviderFormClientProps = {
  provider: RequisiteProviderDetails;
};

export function EditRequisiteProviderFormClient({
  provider,
}: EditRequisiteProviderFormClientProps) {
  const router = useRouter();
  const [current, setCurrent] = useState(provider);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: RequisiteProviderMasterDataInput) {
    setError(null);
    setSubmitting(true);

    const result = await executeMutation<RequisiteProviderDetails>({
      request: () =>
        apiClient.v1.requisites.providers[":id"].$patch({
          param: { id: current.id },
          json: {
            kind: values.kind,
            legalName: values.legalName,
            displayName: values.displayName,
            description: values.description,
            country: values.country,
            website: values.website,
            identifiers: values.identifiers,
            branches: values.branches,
          },
        }),
      fallbackMessage: "Не удалось обновить провайдера реквизитов",
      parseData: async (response) =>
        (await response.json()) as RequisiteProviderDetails,
    });

    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    setCurrent(result.data);
    toast.success("Провайдер реквизитов обновлён");
    router.refresh();

    return result.data;
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);

    const result = await executeMutation<void>({
      request: () =>
        apiClient.v1.requisites.providers[":id"].$delete({
          param: { id: current.id },
        }),
      fallbackMessage: "Не удалось удалить провайдера реквизитов",
      parseData: async () => undefined,
    });

    setDeleting(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return false;
    }

    toast.success("Провайдер реквизитов удалён");
    router.push("/entities/requisite-providers");
    return true;
  }

  return (
    <div className="space-y-6">
      <RequisiteProviderMasterDataEditor
        provider={current}
        submitting={submitting}
        error={error}
        onSubmit={handleSubmit}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          variant="destructive"
          disabled={submitting || deleting}
          onClick={() => void handleDelete()}
        >
          <Trash2 className="size-4" />
          {deleting ? "Удаление..." : "Удалить провайдера"}
        </Button>
      </div>
    </div>
  );
}
